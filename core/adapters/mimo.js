/**
 * MiMo 适配器
 * 操作 xiaomimimo.com 网页聊天界面
 */
import { BaseAdapter } from './base-adapter.js'
import log from 'electron-log'

export class MiMoAdapter extends BaseAdapter {
  name = 'mimo'
  url = 'https://platform.xiaomimimo.com'

  /**
   * MiMo 页面选择器
   * 根据实际页面结构调整，首次使用时需要确认
   */
  selectors = {
    chatInput: '[contenteditable="true"], textarea, .chat-input, input[type="text"]',
    sendButton: 'button[type="submit"], .send-button, .chat-send, button:has(svg)',
    messageList: '.message, .chat-message, .msg-item, [class*="message"]',
    replyIndicator: '.typing, .generating, .loading, [class*="loading"], [class*="streaming"]',
    codeBlock: 'pre code, .code-block, pre',
    newChatButton: '.new-chat, button:has-text("新对话"), [class*="new-chat"]',
  }

  /**
   * 登录 MiMo
   * MiMo 使用小米账号登录，需要用户手动操作
   */
  async login(page) {
    if (await this.isLoggedIn(page)) {
      log.info('MiMo 已登录')
      return
    }

    log.info('MiMo 需要登录，等待用户操作...')
    await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // 等待用户完成登录（跳转到聊天页面）
    try {
      await page.waitForURL('**/chat**', { timeout: 120_000 })
      log.info('MiMo 登录成功')
    } catch {
      // 可能 URL 不含 /chat，尝试等输入框出现
      await page.locator(this.selectors.chatInput).waitFor({ timeout: 60_000 })
      log.info('MiMo 登录成功（通过输入框检测）')
    }
  }

  /**
   * 检查是否已登录
   */
  async isLoggedIn(page) {
    try {
      // 如果能找到输入框，说明已登录
      const input = page.locator(this.selectors.chatInput).first()
      await input.waitFor({ timeout: 5000, state: 'visible' })
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取输入框
   */
  getChatInput(page) {
    return page.locator(this.selectors.chatInput).first()
  }

  /**
   * 发送消息
   */
  async sendMessage(page, text, options = {}) {
    const typingSpeed = options.typingSpeed || [50, 150]
    const delayBeforeSend = options.delayBeforeSend || [1000, 3000]

    // 找到输入框并点击聚焦
    const input = this.getChatInput(page)
    await input.waitFor({ state: 'visible', timeout: 30_000 })
    await input.click()
    await page.waitForTimeout(this._random(300, 800))

    // 清空已有内容
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(200)

    // 模拟人类逐字输入
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: this._random(typingSpeed[0], typingSpeed[1]),
      })
    }

    // 发送前随机停顿
    await page.waitForTimeout(this._random(delayBeforeSend[0], delayBeforeSend[1]))

    // 发送：先尝试点按钮，失败就按 Enter
    try {
      const sendBtn = page.locator(this.selectors.sendButton).first()
      if (await sendBtn.isVisible({ timeout: 2000 })) {
        await sendBtn.click()
      } else {
        await page.keyboard.press('Enter')
      }
    } catch {
      await page.keyboard.press('Enter')
    }

    log.info(`消息已发送 [${text.slice(0, 60)}...]`)
  }

  /**
   * 等待回复完成
   */
  async waitForReply(page, options = {}) {
    const timeout = (options.timeout || 120) * 1000
    const startTime = Date.now()

    log.info('等待 MiMo 回复...')

    // 等待回复指示器出现（表示 AI 开始回复）
    try {
      await page.locator(this.selectors.replyIndicator).first()
        .waitFor({ state: 'visible', timeout: 30_000 })
      log.debug('检测到回复开始')
    } catch {
      log.debug('未检测到回复指示器，继续等待')
    }

    // 等待回复完成：DOM 稳定检测
    await this._waitForDomStable(page, timeout - (Date.now() - startTime))

    // 提取回复
    const reply = await this.extractReply(page)
    log.info(`收到回复 [${reply.slice(0, 80)}...]`)
    return reply
  }

  /**
   * 检测回复是否完成
   */
  async detectReplyComplete(page) {
    try {
      const indicator = page.locator(this.selectors.replyIndicator).first()
      return !(await indicator.isVisible({ timeout: 1000 }))
    } catch {
      return true
    }
  }

  /**
   * 提取最后一条回复
   */
  async extractReply(page) {
    const messages = page.locator(this.selectors.messageList)
    const count = await messages.count()

    if (count === 0) return ''

    // 取最后一条消息（通常是 AI 回复）
    const lastMsg = messages.last()
    const text = await lastMsg.innerText()
    return text.trim()
  }

  // ---- 私有方法 ----

  /**
   * DOM 稳定检测：连续多次检测内容不变则认为回复完成
   */
  async _waitForDomStable(page, timeout) {
    const startTime = Date.now()
    let lastLength = 0
    let stableCount = 0
    const requiredStable = 3      // 连续 3 次不变
    const checkInterval = 2000     // 每 2 秒检测一次

    while (Date.now() - startTime < timeout) {
      await page.waitForTimeout(checkInterval)

      try {
        const reply = await this.extractReply(page)
        const currentLength = reply.length

        if (currentLength > 0 && currentLength === lastLength) {
          stableCount++
          if (stableCount >= requiredStable) {
            log.debug(`回复完成（DOM 稳定 ${requiredStable} 次）`)
            return
          }
        } else {
          stableCount = 0
          lastLength = currentLength
        }

        // 额外检查：回复指示器是否消失
        if (await this.detectReplyComplete(page) && stableCount >= 1) {
          log.debug('回复完成（指示器消失）')
          return
        }
      } catch (err) {
        log.debug(`DOM 检测异常: ${err.message}`)
      }
    }

    log.warn('等待回复超时，使用当前内容')
  }

  _random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
