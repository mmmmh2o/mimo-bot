/**
 * Electron 主进程入口
 * 跨平台：Win/Mac/Linux
 */
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
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

// 配置日志（跨平台）
log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
log.info('MiMo Bot 启动中...')
log.info(`平台: ${process.platform} | 架构: ${process.arch} | Electron: ${process.versions.electron}`)

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

// ---- 单实例锁 ----
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  log.warn('已有实例运行，退出')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'MiMo Bot',
    icon: getIconPath(),
    show: false, // 加载完再显示，避免白屏
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Playwright 需要
    },
  })

  // CSP 安全策略
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          process.env.NODE_ENV === 'development'
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: http://localhost:*"
            : "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        ],
      },
    })
  })

  // 加载完窗口再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 开发模式加载 Vite dev server，生产模式加载打包文件
  const isDev = !app.isPackaged
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/dist/index.html'))
  }

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * 获取应用图标路径（跨平台）
 */
function getIconPath() {
  const ext = process.platform === 'win32' ? 'ico'
    : process.platform === 'darwin' ? 'icns'
    : 'png'
  const iconPath = join(__dirname, `../renderer/public/icon.${ext}`)

  // 生产模式检查打包内图标
  if (app.isPackaged) {
    const packagedPath = join(process.resourcesPath, `icon.${ext}`)
    try {
      const fs = require('fs')
      if (fs.existsSync(packagedPath)) return packagedPath
    } catch {}
  }

  return iconPath
}

async function initServices() {
  try {
  // 用户数据目录（跨平台自动处理）
  const userDataPath = app.getPath('userData')
  log.info(`用户数据目录: ${userDataPath}`)

  // 1. 设置管理器
  settingsManager = new SettingsManager(join(userDataPath, 'settings.json'))
  await settingsManager.load()

  // 2. 数据库
  db = new Database(join(userDataPath, 'bot.db'))
  await db.init()

  // 3. 浏览器控制器
  const browserConfig = settingsManager.get('browser') || {}
  // 生产环境默认 headless（可配置）
  if (app.isPackaged && browserConfig.headless === undefined) {
    browserConfig.headless = false // 默认显示浏览器，方便人工接管
  }
  // 关键：传入用户数据目录，确保 cookie 等数据写到可写路径
  browserConfig.userDataPath = userDataPath
  browserController = new BrowserController(browserConfig)

  // 4. 变量引擎
  variableEngine = new VariableEngine(db)

  // 5. 流程引擎
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

  // 7. Git 同步（workspace 在 userData 目录下）
  gitSync = new GitSync(settingsManager.get('github'), join(userDataPath, 'workspace'))

  // 8. 抓取引擎
  scraper = new Scraper(browserController, db)

  // 9. 插件管理器
  pluginManager = new PluginManager(join(userDataPath, 'plugins'), {
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

  // 10. 注册插件节点
  flowEngine.registerPlugins(pluginManager)

  log.info('所有服务初始化完成')
  } catch (error) {
    log.error('❌ 服务初始化失败:', error)
    log.error('错误堆栈:', error.stack)
    if (mainWindow) {
      mainWindow.webContents.send('init:error', error.message)
    }
    throw error
  }
}

// ============ IPC 处理 ============

function registerIPC() {
  // --- 流程 ---
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

  // --- 变量 ---
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
  ipcMain.handle('browser:open', () => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.open()
  })
  ipcMain.handle('browser:openUrl', (_, url) => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.navigateTo(url)
  })
  ipcMain.handle('browser:screenshot', (_, opts) => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.screenshot(opts)
  })
  ipcMain.handle('browser:executeJs', (_, script) => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.executeJs(script)
  })
  ipcMain.handle('browser:saveCookie', () => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.saveCookie()
  })
  ipcMain.handle('browser:loadCookie', () => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.loadCookie()
  })
  ipcMain.handle('browser:clearCookie', () => {
    if (!browserController) throw new Error('浏览器控制器未初始化，请查看日志')
    return browserController.clearCookie()
  })

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

  // --- 应用信息 ---
  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    userDataPath: app.getPath('userData'),
    isPackaged: app.isPackaged,
  }))
  ipcMain.handle('app:openDataFolder', () => {
    shell.openPath(app.getPath('userData'))
  })
  ipcMain.handle('app:openExternal', (_, url) => {
    shell.openExternal(url)
  })
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
    cleanup()
    app.quit()
  }
})

app.on('before-quit', async () => {
  await cleanup()
  log.info('MiMo Bot 已退出')
})

async function cleanup() {
  scheduler?.stopAll()
  await browserController?.close()
  db?.close()
}
