/**
 * DeepSeek 适配器
 * 操作 chat.deepseek.com 网页聊天界面
 */
import { BaseAdapter } from './base-adapter.js'
import log from 'electron-log'

export class DeepSeekAdapter extends BaseAdapter {
  name = 'deepseek'
  url = 'https://chat.deepseek.com'

  selectors = {
    chatInput: '#chat-input, textarea[placeholder*="输入"], textarea',
    sendButton: 'button[class*="send"], button[aria-label*="发送"], button svg + svg',
    messageList: '.message-content, .ds-markdown, [class*="markdown"]',
    replyIndicator: '.loading-dots, .generating, [class*="loading"], button[class*="stop"]',
    codeBlock: 'pre code',
    newChatButton: 'button:has-text("新对话"), [class*="new-chat"]',
  }

  async login(page) {
    log.info('DeepSeek: 请在浏览器中手动登录')
    await page.waitForURL('**/chat**', { timeout: 300000 })
    log.info('DeepSeek: 登录成功')
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

    await input.click()
    await input.fill('')

    // 模拟打字
    for (const char of text) {
      await input.type(char, {
        delay: typingSpeed[0] + Math.random() * (typingSpeed[1] - typingSpeed[0]),
      })
    }

    // 发送前停顿
    const pause = delayBeforeSend[0] + Math.random() * (delayBeforeSend[1] - delayBeforeSend[0])
    await page.waitForTimeout(pause)

    // 发送（Enter 或点击按钮）
    try {
      const sendBtn = page.locator(this.selectors.sendButton)
      if (await sendBtn.isVisible()) {
        await sendBtn.click()
      } else {
        await input.press('Enter')
      }
    } catch {
      await input.press('Enter')
    }

    log.info('DeepSeek: 消息已发送')
  }

  async waitForReply(page, options = {}) {
    const { timeout = 120 } = options

    // 等待生成开始
    try {
      await page.waitForSelector(this.selectors.replyIndicator, {
        state: 'visible',
        timeout: 15000,
      })
    } catch {
      log.warn('DeepSeek: 未检测到回复指示器，继续等待...')
    }

    // 等待生成完成（指示器消失或停止按钮变为发送按钮）
    try {
      await page.waitForSelector(this.selectors.replyIndicator, {
        state: 'hidden',
        timeout: timeout * 1000,
      })
    } catch {
      // 超时也尝试提取
      log.warn('DeepSeek: 等待回复超时')
    }

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

  async newChat(page) {
    try {
      const btn = page.locator(this.selectors.newChatButton)
      await btn.click()
      await page.waitForTimeout(1000)
      log.info('DeepSeek: 已新建对话')
    } catch (e) {
      log.warn('DeepSeek: 新建对话失败', e.message)
    }
  }
}
