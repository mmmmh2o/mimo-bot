/**
 * ChatGPT 适配器
 * 操作 chat.openai.com 网页聊天界面
 */
import { BaseAdapter } from './base-adapter.js'
import log from 'electron-log'

export class ChatGPTAdapter extends BaseAdapter {
  name = 'chatgpt'
  url = 'https://chat.openai.com'

  selectors = {
    chatInput: '#prompt-textarea, textarea[data-id="root"]',
    sendButton: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
    messageList: '[data-message-author-role="assistant"] .markdown, .agent-turn .markdown',
    replyIndicator: 'button[data-testid="stop-button"], .result-streaming',
    codeBlock: 'pre code',
    newChatButton: 'a[href="/"], button:has-text("New chat")',
  }

  /**
   * 登录 — ChatGPT 使用 OAuth，需用户手动操作
   */
  async login(page) {
    log.info('ChatGPT: 请在浏览器中手动登录')
    await page.waitForURL('**/chat**', { timeout: 300000 })
    log.info('ChatGPT: 登录成功')
  }

  async isLoggedIn(page) {
    try {
      await page.waitForSelector(this.selectors.chatInput, { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  async sendMessage(page, text, options = {}) {
    const { typingSpeed = [30, 80], delayBeforeSend = [500, 1500] } = options

    const input = page.locator(this.selectors.chatInput)
    await input.waitFor({ state: 'visible', timeout: 30000 })

    // 清空输入框
    await input.click()
    await input.fill('')

    // 模拟打字
    for (const char of text) {
      await input.press(char === '\n' ? 'Enter' : char, {
        delay: typingSpeed[0] + Math.random() * (typingSpeed[1] - typingSpeed[0]),
      })
    }

    // 发送前停顿
    const pause = delayBeforeSend[0] + Math.random() * (delayBeforeSend[1] - delayBeforeSend[0])
    await page.waitForTimeout(pause)

    // 点击发送
    const sendBtn = page.locator(this.selectors.sendButton)
    await sendBtn.click()

    log.info('ChatGPT: 消息已发送')
  }

  async waitForReply(page, options = {}) {
    const { timeout = 120 } = options

    // 等待回复指示器出现（表示开始生成）
    try {
      await page.waitForSelector(this.selectors.replyIndicator, {
        state: 'visible',
        timeout: 15000,
      })
    } catch {
      log.warn('ChatGPT: 未检测到回复指示器，继续等待...')
    }

    // 等待回复指示器消失（表示生成完成）
    await page.waitForSelector(this.selectors.replyIndicator, {
      state: 'hidden',
      timeout: timeout * 1000,
    })

    // 额外等待 DOM 稳定
    await page.waitForTimeout(1000)

    return await this.extractReply(page)
  }

  async detectReplyComplete(page) {
    try {
      const indicator = page.locator(this.selectors.replyIndicator)
      return !(await indicator.isVisible())
    } catch {
      return true
    }
  }

  async extractReply(page) {
    const messages = page.locator(this.selectors.messageList)
    const count = await messages.count()
    if (count === 0) return ''

    const lastMessage = messages.last()
    return await lastMessage.innerText()
  }

  /**
   * 新建对话
   */
  async newChat(page) {
    try {
      const btn = page.locator(this.selectors.newChatButton)
      await btn.click()
      await page.waitForTimeout(1000)
      log.info('ChatGPT: 已新建对话')
    } catch (e) {
      log.warn('ChatGPT: 新建对话失败', e.message)
    }
  }
}
