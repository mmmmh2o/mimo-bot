/**
 * Playwright 浏览器控制器
 * 通过适配器系统与不同 AI 网页交互
 */
import { chromium } from 'playwright'
import { getAdapter } from './adapters/index.js'
import log from 'electron-log'

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
   */
  constructor(config = {}) {
    this.config = {
      adapter: config.adapter || 'mimo',
      url: config.url || 'https://platform.xiaomimimo.com',
      timeout: config.timeout || 60000,
      slowMo: config.slowMo || 500,
    }

    // 加载适配器
    this._adapter = getAdapter(this.config.adapter)
    this._browser = null
    this._context = null
    this._page = null
    this._cookiePath = null
    this._db = null
  }

  /**
   * 注入数据库引用（用于保存对话记录等）
   */
  setDatabase(db) {
    this._db = db
  }

  /**
   * 确保浏览器已就绪
   */
  async ensureReady() {
    if (this._page && !this._page.isClosed()) return

    log.info(`启动浏览器 (适配器: ${this._adapter.name})...`)
    this._browser = await chromium.launch({
      headless: false,
      slowMo: this.config.slowMo,
    })

    this._context = await this._browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: this._getUserAgent(),
    })

    // 加载已保存的 Cookie
    if (this._cookiePath) {
      await this._loadCookies()
    }

    this._page = await this._context.newPage()
    await this._page.goto(this.config.url || this._adapter.url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })

    log.info(`浏览器已打开: ${this.config.url || this._adapter.url}`)
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
    const path = await import('path')
    const cookieDir = path.join(process.cwd(), 'data')
    await fs.mkdir(cookieDir, { recursive: true })
    this._cookiePath = path.join(cookieDir, 'cookies.json')
    await fs.writeFile(this._cookiePath, JSON.stringify(cookies, null, 2))
    log.info(`Cookie 已保存到: ${this._cookiePath}`)
    return { success: true, savedAt: new Date().toISOString() }
  }

  /**
   * 加载 Cookie
   */
  async loadCookie() {
    const fs = await import('fs/promises')
    const path = await import('path')
    this._cookiePath = path.join(process.cwd(), 'data', 'cookies.json')
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
    this._cookiePath = null
    log.info('Cookie 已清除')
    return { success: true }
  }

  /**
   * 获取当前页面（人工接管用）
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
    if (!this._cookiePath || !this._context) return
    try {
      const fs = await import('fs/promises')
      const cookies = JSON.parse(await fs.readFile(this._cookiePath, 'utf-8'))
      await this._context.addCookies(cookies)
      log.info(`已加载 ${cookies.length} 个 Cookie`)
    } catch (error) {
      log.warn('Cookie 加载失败，需要重新登录')
    }
  }

  _getUserAgent() {
    const versions = ['120', '121', '122', '123']
    const v = versions[Math.floor(Math.random() * versions.length)]
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`
  }
}
