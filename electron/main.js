/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain, session } from 'electron'
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 配置日志
log.transports.file.level = 'info'
log.info('MiMo Bot 启动中...')

let mainWindow = null
let browserController = null
let flowEngine = null
let db = null
let scheduler = null
let gitSync = null
let pluginManager = null
let settingsManager = null

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
  // 初始化数据库
  db = new Database(join(app.getPath('userData'), 'bot.db'))
  await db.init()

  // 初始化设置管理器
  settingsManager = new SettingsManager(join(app.getPath('userData'), 'settings.json'))

  // 初始化浏览器控制器
  browserController = new BrowserController(settingsManager.get('browser'))

  // 初始化变量引擎
  const variableEngine = new VariableEngine(db)

  // 初始化流程引擎
  flowEngine = new FlowEngine({
    browserController,
    variableEngine,
    db,
    onEvent: (event) => {
      mainWindow?.webContents.send(event.type, event.data)
    },
  })

  // 初始化调度器
  scheduler = new Scheduler(flowEngine)

  // 初始化 Git 同步
  gitSync = new GitSync(settingsManager.get('github'))

  // 初始化插件管理器
  pluginManager = new PluginManager(join(app.getPath('userData'), 'plugins'))
  await pluginManager.scan()

  log.info('所有服务初始化完成')
}

// ============ IPC 处理 ============

function registerIPC() {
  // --- 流程相关 ---
  ipcMain.handle('flow:list', () => db.getFlows())
  ipcMain.handle('flow:get', (_, id) => db.getFlow(id))
  ipcMain.handle('flow:save', (_, flow) => db.saveFlow(flow))
  ipcMain.handle('flow:delete', (_, id) => db.deleteFlow(id))
  ipcMain.handle('flow:run', (_, id) => flowEngine.run(id))
  ipcMain.handle('flow:pause', () => flowEngine.pause())
  ipcMain.handle('flow:resume', () => flowEngine.resume())
  ipcMain.handle('flow:stop', () => flowEngine.stop())
  ipcMain.handle('flow:getStatus', () => flowEngine.getStatus())

  // --- 变量相关 ---
  ipcMain.handle('variable:list', () => db.getVariables())
  ipcMain.handle('variable:get', (_, name) => db.getVariable(name))
  ipcMain.handle('variable:set', (_, name, value) => db.setVariable(name, value))
  ipcMain.handle('variable:delete', (_, name) => db.deleteVariable(name))

  // --- 数据库 ---
  ipcMain.handle('db:tables', () => db.getTables())
  ipcMain.handle('db:query', (_, table, filter) => db.query(table, filter))
  ipcMain.handle('db:insert', (_, table, data) => db.insert(table, data))
  ipcMain.handle('db:update', (_, table, id, data) => db.update(table, id, data))
  ipcMain.handle('db:delete', (_, table, id) => db.deleteRecord(table, id))

  // --- 设置 ---
  ipcMain.handle('settings:get', () => settingsManager.getAll())
  ipcMain.handle('settings:set', (_, settings) => settingsManager.setAll(settings))

  // --- 浏览器 ---
  ipcMain.handle('browser:open', () => browserController.open())
  ipcMain.handle('browser:saveCookie', () => browserController.saveCookie())
  ipcMain.handle('browser:clearCookie', () => browserController.clearCookie())
  ipcMain.handle('browser:screenshot', () => browserController.screenshot())

  // --- GitHub 同步 ---
  ipcMain.handle('git:sync', () => gitSync.sync())
  ipcMain.handle('git:status', () => gitSync.status())

  // --- 抓取 ---
  ipcMain.handle('scrape:run', (_, config) => {
    const { Scraper } = require('../core/scraper.js')
    const scraper = new Scraper(browserController)
    return scraper.run(config)
  })

  // --- 插件 ---
  ipcMain.handle('plugin:list', () => pluginManager.getPlugins())
  ipcMain.handle('plugin:load', (_, path) => pluginManager.load(path))
  ipcMain.handle('plugin:unload', (_, name) => pluginManager.unload(name))
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
  await browserController?.close()
  await db?.close()
  log.info('MiMo Bot 已退出')
})
