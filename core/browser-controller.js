/**
 * Playwright 浏览器控制器
 * 封装所有与 AI 网页的交互操作
 */
import { chromium } from 'playwright'
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
   * @param {string} config.url - 目标 URL
   * @param {number} config.timeout - 超时 (ms)
   * @param {number} config.slowMo - 慢速 (ms)
   * @param {string} config.adapter - 适配器名称
   */
  constructor(config = {}) {
    this.config = {
      url: config.url || 'https://platform.xiaomimimo.com',
      timeout: config.timeout || 60000,
      slowMo: config.slowMo || 500,
      adapter: config.adapter || 'mimo',
    }

    this._browser = null
    this._context = null
    this._page = null
    this._cookiePath = null
  }

  /**
   * 确保浏览器已就绪
   */
  async ensureReady() {
    if (this._page && !this._page.isClosed()) return

    log.info('启动浏览器...')
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
      try {
        const fs = await import('fs/promises')
        const cookies = JSON.parse(await fs.readFile(this._cookiePath, 'utf-8'))
        await this._context.addCookies(cookies)
        log.info(`已加载 ${cookies.length} 个 Cookie`)
      } catch (error) {
        log.warn('Cookie 加载失败，需要重新登录', error)
      }
    }

    this._page = await this._context.newPage()
    await this._page.goto(this.config.url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })

    log.info(`浏览器已打开: ${this.config.url}`)
  }

  /**
   * 打开浏览器用于手动登录
   */
  async open() {
    await this.ensureReady()
  }

  /**
   * 发送消息到 AI 输入框
   * @param {string} text - 消息内容
   * @param {object} options
   * @param {number[]} options.typingSpeed - 打字速度范围 [min, max] ms/字符
   * @param {number[]} options.delayBeforeSend - 发送前延迟 [min, max] ms
   */
  async sendMessage(text, options = {}) {
    await this.ensureReady()

    const page = this._page
    const typingSpeed = options.typingSpeed || [50, 150]
    const delayBeforeSend = options.delayBeforeSend || [1000, 3000]

    // 定位输入框（适配器相关）
    const inputSelector = await this._getSelector('chatInput')
    const input = page.locator(inputSelector)

    await input.waitFor({ state: 'visible', timeout: this.config.timeout })
    await input.click()
    await page.waitForTimeout(this._randomBetween(300, 800))

    // 模拟人类打字
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: this._randomBetween(typingSpeed[0], typingSpeed[1]),
      })
    }

    // 发送前停顿
    await page.waitForTimeout(this._randomBetween(delayBeforeSend[0], delayBeforeSend[1]))

    // 发送
    const sendSelector = await this._getSelector('sendButton')
    await page.click(sendSelector)

    log.info(`消息已发送: ${text.slice(0, 50)}...`)
  }

  /**
   * 等待 AI 回复完成
   * @param {object} options
   * @param {number} options.timeout - 超时 (秒)
   * @returns {Promise<string>} 回复内容
   */
  async waitForReply(options = {}) {
    const page = this._page
    const timeout = (options.timeout || 120) * 1000
    const startTime = Date.now()

    log.info('等待 AI 回复...')

    // 等待回复出现
    const replySelector = await this._getSelector('messageList')
    await page.waitForSelector(replySelector, { timeout })

    // 等待回复完成（流式输出停止）
    await this._waitForReplyComplete(page, timeout - (Date.now() - startTime))

    // 提取回复文本
    const reply = await this._extractReply(page)

    log.info(`收到回复: ${reply.slice(0, 100)}...`)
    return reply
  }

  /**
   * 保存 Cookie
   */
  async saveCookie() {
    if (!this._context) return
    const cookies = await this._context.cookies()
    const fs = await import('fs/promises')
    const path = await import('path')
    const cookieDir = path.join(process.cwd(), 'data')
    await fs.mkdir(cookieDir, { recursive: true })
    this._cookiePath = path.join(cookieDir, 'cookies.json')
    await fs.writeFile(this._cookiePath, JSON.stringify(cookies, null, 2))
    log.info(`Cookie 已保存到: ${this._cookiePath}`)
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
  }

  /**
   * 截图
   */
  async screenshot() {
    await this.ensureReady()
    return await this._page.screenshot({ type: 'png' })
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

  /**
   * 获取当前页面（用于人工接管时的状态读取）
   */
  getPage() {
    return this._page
  }

  // ---- 私有方法 ----

  /**
   * 获取适配器对应的选择器
   */
  async _getSelector(element) {
    // 默认选择器（可根据适配器动态加载）
    const selectors = {
      mimo: {
        chatInput: '[contenteditable="true"], textarea, .chat-input, #chat-input',
        sendButton: 'button[type="submit"], .send-button, .chat-send',
        messageList: '.message-list, .chat-messages, .conversation',
        replyIndicator: '.typing, .generating, .loading',
        codeBlock: 'pre code, .code-block',
      },
      chatgpt: {
        chatInput: '#prompt-textarea',
        sendButton: 'button[data-testid="send-button"]',
        messageList: '.markdown',
        replyIndicator: '.result-streaming',
        codeBlock: 'pre code',
      },
    }

    const adapterName = this.config.adapter || 'mimo'
    const adapterSelectors = selectors[adapterName] || selectors.mimo
    return adapterSelectors[element] || adapterSelectors.chatInput
  }

  /**
   * 等待回复完成（流式输出停止）
   */
  async _waitForReplyComplete(page, timeout) {
    const startTime = Date.now()
    let lastLength = 0
    let stableCount = 0

    while (Date.now() - startTime < timeout) {
      await page.waitForTimeout(2000)

      const replySelector = await this._getSelector('messageList')
      const currentText = await page.locator(replySelector).last().innerText()

      if (currentText.length === lastLength) {
        stableCount++
        if (stableCount >= 3) {
          // 连续 3 次检测没有变化，认为回复完成
          return
        }
      } else {
        stableCount = 0
        lastLength = currentText.length
      }

      // 检查是否还有生成指示器
      const indicatorSelector = await this._getSelector('replyIndicator')
      const indicator = page.locator(indicatorSelector)
      if (await indicator.count() === 0 && stableCount >= 1) {
        return
      }
    }

    log.warn('等待回复超时，使用当前内容')
  }

  /**
   * 提取回复文本
   */
  async _extractReply(page) {
    const replySelector = await this._getSelector('messageList')
    const messages = page.locator(replySelector)
    const lastMessage = messages.last()
    const text = await lastMessage.innerText()
    return text.trim()
  }

  /**
   * 生成随机 User-Agent
   */
  _getUserAgent() {
    const versions = ['120', '121', '122', '123']
    const v = versions[Math.floor(Math.random() * versions.length)]
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`
  }

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
