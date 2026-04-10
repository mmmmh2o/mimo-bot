# AI 适配器开发

## 概述

适配器是 MiMo Bot 与不同 AI 网页对话的桥梁。每个适配器定义了如何在特定 AI 网站上发送消息、等待回复、提取内容。

## 内置适配器

| 适配器 | 状态 | 说明 |
|--------|------|------|
| MiMo | 🔧 开发中 | xiaomimimo.com |
| ChatGPT | 📋 计划中 | chat.openai.com |
| DeepSeek | 📋 计划中 | chat.deepseek.com |
| Kimi | 📋 计划中 | kimi.moonshot.cn |

## BaseAdapter 接口

所有适配器必须继承 `BaseAdapter` 并实现以下接口：

```javascript
// core/adapters/base-adapter.js
export class BaseAdapter {
  /** 适配器唯一名称 */
  name = 'base'

  /** 目标网站 URL */
  url = ''

  /** 是否需要浏览器（vs 纯 API） */
  requiresBrowser = true

  /** 页面元素选择器映射 */
  selectors = {
    chatInput: '',       // 输入框选择器
    sendButton: '',      // 发送按钮选择器
    messageList: '',     // 消息列表容器
    replyIndicator: '',  // 回复中指示器（loading/typing）
    codeBlock: '',       // 代码块选择器
  }

  /**
   * 执行登录流程
   * @param {Page} page - Playwright 页面实例
   */
  async login(page) { ... }

  /**
   * 检查登录状态
   * @returns {Promise<boolean>}
   */
  async isLoggedIn(page) { ... }

  /**
   * 获取输入框 Locator
   * @returns {Locator}
   */
  getChatInput(page) { ... }

  /**
   * 发送消息
   * @param {Page} page
   * @param {string} text - 消息内容
   * @param {object} options
   * @param {[number,number]} options.typingSpeed - 打字速度范围
   * @param {[number,number]} options.delayBeforeSend - 发送前延迟
   */
  async sendMessage(page, text, options) { ... }

  /**
   * 等待 AI 回复完成
   * @param {Page} page
   * @param {object} options
   * @param {number} options.timeout - 超时秒数
   * @returns {Promise<string>} 回复文本
   */
  async waitForReply(page, options) { ... }

  /**
   * 检测回复是否完成
   * @returns {Promise<boolean>}
   */
  async detectReplyComplete(page) { ... }

  /**
   * 提取最后一条回复的文本
   * @returns {Promise<string>}
   */
  async extractReply(page) { ... }
}
```

## 开发新适配器

### 1. 创建适配器文件

```javascript
// core/adapters/my-ai.js
import { BaseAdapter } from './base-adapter.js'

export class MyAIAdapter extends BaseAdapter {
  name = 'my-ai'
  url = 'https://my-ai.com/chat'

  selectors = {
    chatInput: 'div[contenteditable="true"]',
    sendButton: 'button.send-btn',
    messageList: '.message-container .message',
    replyIndicator: '.typing-indicator',
    codeBlock: 'pre code',
  }

  async login(page) {
    // 检查是否需要登录
    if (await this.isLoggedIn(page)) return

    // 跳转登录页
    await page.goto(`${this.url}/login`)
    // 等待用户手动登录（或自动填写）
    await page.waitForURL('**/chat', { timeout: 120_000 })
  }

  async isLoggedIn(page) {
    await page.goto(this.url)
    // 检查页面是否已进入聊天界面
    try {
      await page.locator(this.selectors.chatInput).waitFor({ timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  async sendMessage(page, text, options = {}) {
    const input = this.getChatInput(page)
    await input.click()
    await page.waitForTimeout(500)

    // 模拟人类打字
    const [minSpeed, maxSpeed] = options.typingSpeed || [50, 150]
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: minSpeed + Math.random() * (maxSpeed - minSpeed)
      })
    }

    // 随机停顿后发送
    const [minDelay, maxDelay] = options.delayBeforeSend || [1000, 3000]
    await page.waitForTimeout(minDelay + Math.random() * (maxDelay - minDelay))
    await page.keyboard.press('Enter')
  }

  async waitForReply(page, options = {}) {
    const timeout = (options.timeout || 120) * 1000

    // 等待回复指示器出现
    await page.locator(this.selectors.replyIndicator)
      .waitFor({ state: 'visible', timeout: 30_000 })

    // 等待回复指示器消失（回复完成）
    await page.locator(this.selectors.replyIndicator)
      .waitFor({ state: 'hidden', timeout })

    // 提取回复文本
    return await this.extractReply(page)
  }

  async detectReplyComplete(page) {
    const indicator = page.locator(this.selectors.replyIndicator)
    return !(await indicator.isVisible())
  }

  async extractReply(page) {
    const messages = page.locator(this.selectors.messageList)
    const lastMessage = messages.last()

    // 处理代码块格式
    const text = await lastMessage.innerText()
    return text
  }
}
```

### 2. 注册适配器

```javascript
// core/adapters/index.js
import { MyAIAdapter } from './my-ai.js'

export const adapters = {
  'my-ai': MyAIAdapter,
  // ... 其他适配器
}

export function getAdapter(name) {
  const AdapterClass = adapters[name]
  if (!AdapterClass) throw new Error(`未知适配器: ${name}`)
  return new AdapterClass()
}
```

### 3. 在 UI 中配置

设置页面会自动列出所有注册的适配器，用户选择后流程会使用对应适配器的 `selectors` 和操作策略。

## 调试技巧

```javascript
// 1. 用 Playwright codegen 录制操作，自动生成选择器
// npx playwright codegen https://my-ai.com

// 2. 在浏览器 DevTools 里测试选择器
// document.querySelector('你的选择器')

// 3. 截图调试
async function debugScreenshot(page, label) {
  await page.screenshot({ path: `debug-${label}.png` })
}

// 4. 逐步执行，观察 DOM 变化
await page.pause() // 打开 Playwright Inspector
```

## 常见问题

### 输入框是 contenteditable div

大多数 AI 聊天框用 `<div contenteditable="true">` 而非 `<textarea>`：

```javascript
// ❌ 不要用 fill()
await page.locator('.chat-input').fill(text)

// ✅ 用 keyboard.type 模拟真实输入
await page.locator('.chat-input').click()
await page.keyboard.type(text, { delay: 80 })
```

### 回复是流式输出

AI 回复逐字出现，检测完成的常见策略：

```javascript
// 策略 1: 等 loading 元素消失（最可靠）
await page.locator('.loading-spinner').waitFor({ state: 'hidden' })

// 策略 2: 检测 DOM 稳定（连续 2 秒无变化）
let lastText = ''
let stableCount = 0
while (stableCount < 4) {
  await page.waitForTimeout(500)
  const currentText = await page.locator('.reply').innerText()
  if (currentText === lastText) stableCount++
  else { stableCount = 0; lastText = currentText }
}

// 策略 3: 等"停止生成"按钮消失
await page.locator('button.stop-generating').waitFor({ state: 'hidden' })
```

### 处理文件上传

```javascript
// 监听文件选择器事件
page.on('filechooser', async (chooser) => {
  await chooser.setFiles('/path/to/file.pdf')
})

// 然后触发上传
await page.locator('button.upload').click()
```
