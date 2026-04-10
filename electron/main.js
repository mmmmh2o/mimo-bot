/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import log from 'electron-log'
import { FlowEngine } from '../core/engine.js'
import { VariableEngine } from '../core/variables.js'
import { BrowserController } from '../core/browser-controller.js'
import { Database } from '../core/database.js'
import { Scheduler } from '../core/scheduler.js'
import { GitSync } from '../core/git-sync.js'
import { PluginManager } from '../core/plugins/plugin-manager.js'
import { SettingsManager } from '../core/settings.js'
import { Scraper } from '../core/scraper.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 配置日志
log.transports.file.level = 'info'
log.info('MiMo Bot 启动中...')

let mainWindow = null
let browserController = null
let flowEngine = null
let variableEngine = null
let db = null
let scheduler = null
let gitSync = null
let pluginManager = null
let settingsManager = null
let scraper = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'MiMo Bot',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 开发模式加载 Vite dev server，生产模式加载打包文件
  const isDev = !app.isPackaged
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function initServices() {
  // 1. 设置管理器（最先加载，其他服务依赖配置）
  settingsManager = new SettingsManager(join(app.getPath('userData'), 'settings.json'))
  await settingsManager.load()

  // 2. 数据库
  db = new Database(join(app.getPath('userData'), 'bot.db'))
  await db.init()

  // 3. 浏览器控制器（依赖 settings）
  browserController = new BrowserController(settingsManager.get('browser'))

  // 4. 变量引擎
  variableEngine = new VariableEngine(db)

  // 5. 流程引擎（依赖 browser + variables + db）
  flowEngine = new FlowEngine({
    browserController,
    variableEngine,
    db,
    onEvent: (event) => {
      mainWindow?.webContents.send(event.type, event.data)
    },
  })

  // 6. 调度器
  scheduler = new Scheduler(flowEngine)

  // 7. Git 同步
  gitSync = new GitSync(settingsManager.get('github'))

  // 8. 抓取引擎
  scraper = new Scraper(browserController, db)

  // 9. 插件管理器（最后加载，可依赖其他服务）
  pluginManager = new PluginManager(join(app.getPath('userData'), 'plugins'), {
    variables: variableEngine,
    browser: browserController,
    db,
    emit: (event, data) => {
      mainWindow?.webContents.send(event, data)
    },
    log,
    settings: settingsManager,
  })
  await pluginManager.scan()

  // 10. 将插件注册的节点类型注入引擎
  flowEngine.registerPlugins(pluginManager)

  log.info('所有服务初始化完成')
}

// ============ IPC 处理 ============

function registerIPC() {
  // --- 流程相关 ---
  ipcMain.handle('flow:list', () => db.getFlows())
  ipcMain.handle('flow:get', (_, id) => db.getFlow(id))
  ipcMain.handle('flow:save', (_, flow) => {
    db.saveFlow(flow)
    return { id: flow.id, updatedAt: new Date().toISOString() }
  })
  ipcMain.handle('flow:delete', (_, id) => { db.deleteFlow(id); return { success: true } })
  ipcMain.handle('flow:duplicate', (_, id) => {
    const original = db.getFlow(id)
    if (!original) throw new Error(`流程 ${id} 不存在`)
    const newFlow = { ...original, id: `${id}-copy-${Date.now()}`, name: `${original.name} (副本)` }
    db.saveFlow(newFlow)
    return { id: newFlow.id }
  })
  ipcMain.handle('flow:run', (_, id, inputVars) => flowEngine.run(id, inputVars))
  ipcMain.handle('flow:pause', () => flowEngine.pause())
  ipcMain.handle('flow:resume', () => flowEngine.resume())
  ipcMain.handle('flow:stop', () => flowEngine.stop())
  ipcMain.handle('flow:getStatus', () => flowEngine.getStatus())
  ipcMain.handle('flow:getHistory', (_, flowId, opts) => db.getConversationHistory(flowId, opts))

  // --- 变量相关 ---
  ipcMain.handle('variable:list', () => variableEngine.list())
  ipcMain.handle('variable:get', (_, name) => variableEngine.get(name))
  ipcMain.handle('variable:set', (_, name, value, scope) => {
    variableEngine.set(name, value, scope)
    return { success: true }
  })
  ipcMain.handle('variable:delete', (_, name) => { variableEngine.delete(name); return { success: true } })
  ipcMain.handle('variable:export', () => variableEngine.exportAll())
  ipcMain.handle('variable:import', (_, vars) => {
    for (const [name, config] of Object.entries(vars)) {
      variableEngine.set(name, config.value, config.scope, config.type)
    }
    return { success: true }
  })

  // --- 数据库 ---
  ipcMain.handle('db:getTables', () => db.getTables())
  ipcMain.handle('db:query', (_, table, filter) => db.query(table, filter))
  ipcMain.handle('db:insert', (_, table, data) => { db.insert(table, data); return { success: true } })
  ipcMain.handle('db:update', (_, table, id, data) => { db.update(table, id, data); return { success: true } })
  ipcMain.handle('db:delete', (_, table, id) => { db.deleteRecord(table, id); return { success: true } })

  // --- 设置 ---
  ipcMain.handle('settings:get', () => settingsManager.getAll())
  ipcMain.handle('settings:getSection', (_, section) => settingsManager.get(section))
  ipcMain.handle('settings:set', (_, section, values) => {
    const current = settingsManager.get(section) || {}
    settingsManager.set(section, { ...current, ...values })
    settingsManager.save()
    return { success: true }
  })
  ipcMain.handle('settings:reset', () => { settingsManager.reset(); settingsManager.save(); return { success: true } })

  // --- 浏览器 ---
  ipcMain.handle('browser:open', () => browserController.open())
  ipcMain.handle('browser:openUrl', (_, url) => browserController.navigateTo(url))
  ipcMain.handle('browser:screenshot', (_, opts) => browserController.screenshot(opts))
  ipcMain.handle('browser:executeJs', (_, script) => browserController.executeJs(script))
  ipcMain.handle('browser:saveCookie', () => browserController.saveCookie())
  ipcMain.handle('browser:loadCookie', () => browserController.loadCookie())
  ipcMain.handle('browser:clearCookie', () => browserController.clearCookie())

  // --- GitHub 同步 ---
  ipcMain.handle('git:sync', (_, opts) => gitSync.sync(opts))
  ipcMain.handle('git:status', () => gitSync.status())
  ipcMain.handle('git:log', (_, opts) => gitSync.log(opts))

  // --- 抓取 ---
  ipcMain.handle('scraper:run', (_, config) => scraper.run(config))
  ipcMain.handle('scraper:schedule', (_, name, config, cron) => scraper.schedule(name, config, cron))
  ipcMain.handle('scraper:listTasks', () => scraper.listTasks())
  ipcMain.handle('scraper:deleteTask', (_, taskId) => scraper.deleteTask(taskId))

  // --- 插件 ---
  ipcMain.handle('plugin:list', () => pluginManager.getPlugins())
  ipcMain.handle('plugin:enable', (_, name) => pluginManager.enable(name))
  ipcMain.handle('plugin:disable', (_, name) => pluginManager.disable(name))
  ipcMain.handle('plugin:install', (_, dirPath) => pluginManager.install(dirPath))
  ipcMain.handle('plugin:uninstall', (_, name) => pluginManager.uninstall(name))

  // --- 调度 ---
  ipcMain.handle('schedule:list', () => scheduler.list())
  ipcMain.handle('schedule:add', (_, config) => { scheduler.add(config); return { success: true } })
  ipcMain.handle('schedule:update', (_, id, config) => { scheduler.update(id, config); return { success: true } })
  ipcMain.handle('schedule:delete', (_, id) => { scheduler.remove(id); return { success: true } })
  ipcMain.handle('schedule:runNow', (_, id) => scheduler.runNow(id))
}

// ============ 应用生命周期 ============

app.whenReady().then(async () => {
  registerIPC()
  await initServices()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    browserController?.close()
    db?.close()
    app.quit()
  }
})

app.on('before-quit', async () => {
  scheduler?.stopAll()
  await browserController?.close()
  db?.close()
  log.info('MiMo Bot 已退出')
})
