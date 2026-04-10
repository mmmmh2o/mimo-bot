/**
 * AI 适配器基类
 * 所有 AI 适配器需要继承此类并实现接口方法
 */
export class BaseAdapter {
  /** @type {string} 适配器名称 */
  name = 'base'

  /** @type {string} 目标网站 URL */
  url = ''

  /** @type {boolean} 是否需要浏览器操作 */
  requiresBrowser = true

  /**
   * 页面元素选择器
   * 子类必须覆盖
   */
  selectors = {
    chatInput: '',
    sendButton: '',
    messageList: '',
    replyIndicator: '',
    codeBlock: '',
  }

  /**
   * 登录
   * @param {import('playwright').Page} page
   */
  async login(page) {
    throw new Error('子类必须实现 login 方法')
  }

  /**
   * 检查是否已登录
   * @param {import('playwright').Page} page
   * @returns {Promise<boolean>}
   */
  async isLoggedIn(page) {
    throw new Error('子类必须实现 isLoggedIn 方法')
  }

  /**
   * 获取输入框元素
   * @param {import('playwright').Page} page
   * @returns {import('playwright').Locator}
   */
  getChatInput(page) {
    return page.locator(this.selectors.chatInput)
  }

  /**
   * 发送消息
   * @param {import('playwright').Page} page
   * @param {string} text
   * @param {object} options
   */
  async sendMessage(page, text, options = {}) {
    throw new Error('子类必须实现 sendMessage 方法')
  }

  /**
   * 等待回复完成
   * @param {import('playwright').Page} page
   * @param {object} options
   * @returns {Promise<string>}
   */
  async waitForReply(page, options = {}) {
    throw new Error('子类必须实现 waitForReply 方法')
  }

  /**
   * 检测回复是否完成
   * @param {import('playwright').Page} page
   * @returns {Promise<boolean>}
   */
  async detectReplyComplete(page) {
    throw new Error('子类必须实现 detectReplyComplete 方法')
  }

  /**
   * 提取回复文本
   * @param {import('playwright').Page} page
   * @returns {Promise<string>}
   */
  async extractReply(page) {
    const messages = page.locator(this.selectors.messageList)
    const lastMessage = messages.last()
    return await lastMessage.innerText()
  }
}
