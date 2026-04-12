/**
 * Playwright 浏览器控制器
 * 通过适配器系统与不同 AI 网页交互
 * 跨平台：Win/Mac/Linux
 */
import { chromium } from 'playwright'
import { getAdapter } from './adapters/index.js'
import { existsSync, readdirSync, statSync } from 'fs'
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

    // 始终设置 PLAYWRIGHT_BROWSERS_PATH（Playwright 内部可能忽略 executablePath）
    if (process.resourcesPath) {
      const bundledBrowserDir = join(process.resourcesPath, 'chromium')
      if (existsSync(bundledBrowserDir)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowserDir
        log.info(`PLAYWRIGHT_BROWSERS_PATH = ${bundledBrowserDir}`)
      }
    }

    if (!executablePath && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
      log.warn('未找到 Chromium，Playwright 将尝试默认路径')
    }

    try {
      this._browser = await chromium.launch(launchOptions)
    } catch (error) {
      log.error(`chromium.launch 失败: ${error.message}`)
      log.error(`  executablePath: ${launchOptions.executablePath || '(未指定)'}`)
      log.error(`  PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || '(未设置)'}`)
      log.error(`  resourcesPath: ${process.resourcesPath || '(未设置)'}`)
      for (const dir of [join(process.resourcesPath || '', 'chromium'), process.resourcesPath || '']) {
        if (!dir || !existsSync(dir)) continue
        try {
          const entries = readdirSync(dir).slice(0, 10)
          log.error(`  ${dir}/: ${entries.join(', ')}`)
        } catch {}
      }
      throw new Error(`${error.message}\n请运行 npx playwright install chromium 下载浏览器`)
    }

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
    const binaryName = process.platform === 'win32' ? 'chrome.exe' : 'chrome'

    // 1. 打包环境：extraResources 中的浏览器
    //    Playwright 目录结构: chromium/chromium-XXXX/chrome-linux/chrome
    if (process.resourcesPath) {
      const bundledDir = join(process.resourcesPath, 'chromium')
      if (existsSync(bundledDir)) {
        // 先尝试已知的 Playwright 子目录模式
        const candidate = this._findInPlaywrightDir(bundledDir, binaryName)
        if (candidate) {
          log.info(`找到 Chromium (bundled): ${candidate}`)
          return candidate
        }
        // 兜底：递归搜索
        const found = this._findExecutable(bundledDir, binaryName)
        if (found) {
          log.info(`找到 Chromium (recursive): ${found}`)
          return found
        }
        // 列出目录内容帮助调试
        try {
          const entries = readdirSync(bundledDir)
          log.warn(`chromium/ 目录内容: ${entries.join(', ')}`)
          for (const e of entries) {
            const sub = join(bundledDir, e)
            try {
              if (statSync(sub).isDirectory()) {
                log.warn(`  ${e}/: ${readdirSync(sub).slice(0, 10).join(', ')}`)
              }
            } catch {}
          }
        } catch {}
      }
    }

    // 2. Playwright 默认缓存路径
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const cacheDirs = [
      home && join(home, '.cache', 'ms-playwright'),
      home && join(home, 'Library', 'Caches', 'ms-playwright'),
      home && join(home, 'AppData', 'Local', 'ms-playwright'),
      process.env.PLAYWRIGHT_BROWSERS_PATH,
    ].filter(Boolean)

    for (const dir of cacheDirs) {
      if (!existsSync(dir)) continue
      const candidate = this._findInPlaywrightDir(dir, binaryName)
      if (candidate) {
        log.info(`找到 Chromium (cache): ${candidate}`)
        return candidate
      }
    }

    // 3. 系统浏览器
    const systemPaths = {
      linux: ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'],
      darwin: ['/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
    }
    for (const p of (systemPaths[process.platform] || [])) {
      if (existsSync(p)) {
        log.info(`使用系统浏览器: ${p}`)
        return p
      }
    }

    log.warn('未找到 Chromium')
    return null
  }

  /**
   * 在 Playwright 浏览器目录中查找可执行文件
   * 结构: dir/chromium-XXXX/chrome-linux/chrome (Linux)
   *       dir/chromium-XXXX/chrome-mac/Chromium.app/Contents/MacOS/Chromium (Mac)
   *       dir/chromium-XXXX/chrome-win/chrome.exe (Win)
   */
  _findInPlaywrightDir(dir, binaryName) {
    try {
      const entries = readdirSync(dir)
      // 查找 chromium-* 或 chrome-* 开头的版本目录
      const versionDirs = entries.filter(e =>
        e.startsWith('chromium-') || e.startsWith('chrome-')
      )
      for (const verDir of versionDirs) {
        const verPath = join(dir, verDir)
        try {
          if (!statSync(verPath).isDirectory()) continue
        } catch { continue }
        // 在版本目录下递归查找
        const found = this._findExecutable(verPath, binaryName)
        if (found) return found
      }
    } catch {}
    return null
  }

  /**
   * 递归查找可执行文件
   */
  _findExecutable(dir, binaryName, depth = 0) {
    if (depth > 6) return null
    try {
      const entries = readdirSync(dir)
      // 先检查当前目录是否有目标文件
      for (const entry of entries) {
        if (entry === binaryName) {
          const full = join(dir, entry)
          if (existsSync(full)) return full
        }
      }
      // 再递归子目录
      for (const entry of entries) {
        const full = join(dir, entry)
        try {
          if (statSync(full).isDirectory()) {
            const found = this._findExecutable(full, binaryName, depth + 1)
            if (found) return found
          }
        } catch {}
      }
    } catch {}
    return null
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

  // ---- 原子操作（自定义模式用）----

  /**
   * 按选择器逐字输入
   */
  async type(selector, text, options = {}) {
    await this.ensureReady()
    const loc = this._page.locator(selector)
    await loc.waitFor({ state: 'visible', timeout: options.timeout || 10000 })
    const speed = options.typingSpeed || [50, 150]
    await loc.pressSequentially(text, {
      delay: Array.isArray(speed)
        ? speed[0] + Math.random() * (speed[1] - speed[0])
        : speed,
    })
    log.info(`type 完成: ${selector} (${text.length} 字符)`)
  }

  /**
   * 按选择器一次性填入（fill）
   */
  async fill(selector, text, options = {}) {
    await this.ensureReady()
    const loc = this._page.locator(selector)
    await loc.waitFor({ state: 'visible', timeout: options.timeout || 10000 })
    await loc.fill(text)
    log.info(`fill 完成: ${selector} (${text.length} 字符)`)
  }

  /**
   * 按选择器点击
   */
  async click(selector, options = {}) {
    await this.ensureReady()
    const loc = this._page.locator(selector)
    await loc.waitFor({ state: 'visible', timeout: options.timeout || 10000 })
    await loc.click()
    log.info(`click 完成: ${selector}`)
  }

  /**
   * 在指定元素上按回车
   */
  async pressEnter(selector, options = {}) {
    await this.ensureReady()
    const loc = this._page.locator(selector)
    await loc.waitFor({ state: 'visible', timeout: options.timeout || 10000 })
    await loc.press('Enter')
    log.info(`pressEnter 完成: ${selector}`)
  }

  /**
   * 等待元素出现
   */
  async waitForSelector(selector, options = {}) {
    await this.ensureReady()
    const state = options.state || 'visible'
    const timeout = (options.timeout || 30) * 1000
    await this._page.locator(selector).waitFor({ state, timeout })
    log.info(`waitForSelector 完成: ${selector} (state: ${state})`)
  }

  /**
   * 获取元素文本
   * @param {string} selector
   * @param {object} options - { which: 'first'|'last'|'all', timeout }
   * @returns {string|string[]}
   */
  async getText(selector, options = {}) {
    await this.ensureReady()
    const loc = this._page.locator(selector)
    const which = options.which || 'first'
    const timeout = (options.timeout || 10) * 1000

    if (which === 'all') {
      await loc.first().waitFor({ state: 'visible', timeout })
      return await loc.allTextContents()
    }

    const target = which === 'last' ? loc.last() : loc.first()
    await target.waitFor({ state: 'visible', timeout })
    return await target.textContent()
  }

  /**
   * 等待选择器匹配的内容出现新文本，返回新文本
   * 通过监听 DOM 变化实现
   */
  async waitForAndGetText(selector, options = {}) {
    await this.ensureReady()
    const timeout = (options.timeout || 120) * 1000
    const loc = this._page.locator(selector).last()

    // 先拿到当前文本（可能为空）
    let oldText = ''
    try {
      await loc.waitFor({ state: 'attached', timeout: 5000 })
      oldText = await loc.textContent() || ''
    } catch {}

    // 轮询等待文本变化
    const start = Date.now()
    while (Date.now() - start < timeout) {
      await this._page.waitForTimeout(1000)
      try {
        const newText = await loc.textContent() || ''
        if (newText && newText !== oldText) {
          log.info(`waitForAndGetText 完成: ${selector}`)
          return newText
        }
      } catch {}
    }

    // 超时，返回当前文本
    log.warn(`waitForAndGetText 超时 (${options.timeout}s): ${selector}`)
    return await loc.textContent() || ''
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
