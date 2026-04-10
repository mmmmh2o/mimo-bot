/**
 * Playwright 浏览器控制器
 * 通过适配器系统与不同 AI 网页交互
 * 跨平台：Win/Mac/Linux
 */
import { chromium } from 'playwright'
import { getAdapter } from './adapters/index.js'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class AdapterError extends Error {
  constructor(adapterName, operation, cause) {
    super(`适配器 ${adapterName} 的 ${operation} 操作失败: ${cause?.message || cause}`)
    this.name = 'AdapterError'
    this.adapterName = adapterName
    this.operation = operation
    this.cause = cause
  }
}

export class BrowserController {
  /**
   * @param {object} config
   * @param {string} config.adapter - 适配器名称 (mimo/chatgpt/...)
   * @param {string} config.url - 目标 URL
   * @param {number} config.timeout - 超时 (ms)
   * @param {number} config.slowMo - 慢速 (ms)
   * @param {boolean} config.headless - 无头模式
   * @param {string} config.userDataPath - 用户数据目录
   */
  constructor(config = {}) {
    this.config = {
      adapter: config.adapter || 'mimo',
      url: config.url || 'https://platform.xiaomimimo.com',
      timeout: config.timeout || 60000,
      slowMo: config.slowMo || 500,
      headless: config.headless ?? false,
      userDataPath: config.userDataPath || null,
    }

    // 加载适配器
    this._adapter = getAdapter(this.config.adapter)
    this._browser = null
    this._context = null
    this._page = null
    this._db = null
  }

  /**
   * 注入数据库引用
   */
  setDatabase(db) {
    this._db = db
  }

  /**
   * 获取 Cookie 文件路径
   */
  get _cookiePath() {
    const dir = this.config.userDataPath || join(process.cwd(), 'data')
    return join(dir, 'cookies.json')
  }

  /**
   * 确保浏览器已就绪
   */
  async ensureReady() {
    if (this._page && !this._page.isClosed()) return

    log.info(`启动浏览器 (适配器: ${this._adapter.name}, headless: ${this.config.headless})...`)

    const launchOptions = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    }

    // 打包环境：指定 Playwright 浏览器路径
    const executablePath = this._findChromium()
    if (executablePath) {
      launchOptions.executablePath = executablePath
      log.info(`使用 Chromium: ${executablePath}`)
    }

    this._browser = await chromium.launch(launchOptions)

    this._context = await this._browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: this._getUserAgent(),
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
    })

    // 加载已保存的 Cookie
    await this._loadCookies()

    this._page = await this._context.newPage()
    await this._page.goto(this.config.url || this._adapter.url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })

    log.info(`浏览器已打开: ${this.config.url || this._adapter.url}`)
  }

  /**
   * 查找 Chromium 可执行文件（打包环境兼容）
   */
  _findChromium() {
    // 1. 打包环境：检查 resources 目录
    if (process.resourcesPath) {
      const candidates = [
        join(process.resourcesPath, 'chromium', 'chrome'),
        join(process.resourcesPath, 'chromium', 'chromium'),
        join(process.resourcesPath, 'chromium', 'chrome.exe'),
      ]
      for (const p of candidates) {
        if (existsSync(p)) return p
      }
    }

    // 2. 开发环境：使用 Playwright 自带浏览器（默认行为）
    // 3. 系统浏览器
    const systemPaths = {
      linux: ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'],
      darwin: ['/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
    }
    const paths = systemPaths[process.platform] || []
    for (const p of paths) {
      if (existsSync(p)) return p
    }

    return null // 回退到 Playwright 默认
  }

  /**
   * 打开浏览器用于手动登录
   */
  async open() {
    await this.ensureReady()
  }

  /**
   * 导航到指定 URL
   */
  async navigateTo(url) {
    await this.ensureReady()
    await this._page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })
  }

  /**
   * 发送消息（委托给适配器）
   */
  async sendMessage(text, options = {}) {
    await this.ensureReady()
    try {
      await this._adapter.sendMessage(this._page, text, {
        typingSpeed: options.typingSpeed || [50, 150],
        delayBeforeSend: options.delayBeforeSend || [1000, 3000],
      })
    } catch (error) {
      throw new AdapterError(this._adapter.name, 'sendMessage', error)
    }
  }

  /**
   * 等待回复（委托给适配器）
   */
  async waitForReply(options = {}) {
    await this.ensureReady()
    try {
      return await this._adapter.waitForReply(this._page, {
        timeout: options.timeout || 120,
      })
    } catch (error) {
      throw new AdapterError(this._adapter.name, 'waitForReply', error)
    }
  }

  /**
   * 在页面中执行 JavaScript
   */
  async executeJs(script) {
    await this.ensureReady()
    return await this._page.evaluate(script)
  }

  /**
   * 截图
   */
  async screenshot(options = {}) {
    await this.ensureReady()
    if (options.selector) {
      const el = this._page.locator(options.selector)
      return await el.screenshot({ type: 'png' })
    }
    return await this._page.screenshot({
      type: 'png',
      fullPage: options.fullPage || false,
    })
  }

  /**
   * 保存 Cookie
   */
  async saveCookie() {
    if (!this._context) return { success: false }
    const cookies = await this._context.cookies()
    const fs = await import('fs/promises')
    const dir = dirname(this._cookiePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(this._cookiePath, JSON.stringify(cookies, null, 2))
    log.info(`Cookie 已保存: ${this._cookiePath}`)
    return { success: true, savedAt: new Date().toISOString() }
  }

  /**
   * 加载 Cookie
   */
  async loadCookie() {
    await this._loadCookies()
    return { success: true }
  }

  /**
   * 清除 Cookie
   */
  async clearCookie() {
    if (this._context) {
      await this._context.clearCookies()
    }
    try {
      const fs = await import('fs/promises')
      await fs.unlink(this._cookiePath)
    } catch {}
    log.info('Cookie 已清除')
    return { success: true }
  }

  /**
   * 获取当前页面
   */
  getPage() {
    return this._page
  }

  /**
   * 获取当前适配器
   */
  getAdapter() {
    return this._adapter
  }

  /**
   * 切换适配器
   */
  switchAdapter(name) {
    this._adapter = getAdapter(name)
    this.config.adapter = name
    log.info(`适配器已切换: ${name}`)
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this._browser) {
      await this._browser.close()
      this._browser = null
      this._context = null
      this._page = null
      log.info('浏览器已关闭')
    }
  }

  // ---- 私有方法 ----

  async _loadCookies() {
    if (!this._context) return
    try {
      const fs = await import('fs/promises')
      const raw = await fs.readFile(this._cookiePath, 'utf-8')
      const cookies = JSON.parse(raw)
      await this._context.addCookies(cookies)
      log.info(`已加载 ${cookies.length} 个 Cookie`)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        log.warn('Cookie 加载失败:', error.message)
      }
    }
  }

  _getUserAgent() {
    const versions = ['120', '121', '122', '123']
    const v = versions[Math.floor(Math.random() * versions.length)]
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`
  }
}
