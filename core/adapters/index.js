/**
 * AI 适配器注册表
 */
import { MiMoAdapter } from './mimo.js'
import { ChatGPTAdapter } from './chatgpt.js'
import { DeepSeekAdapter } from './deepseek.js'

export { BaseAdapter } from './base-adapter.js'

// 所有适配器注册在此
const adapters = {
  mimo: MiMoAdapter,
  chatgpt: ChatGPTAdapter,
  deepseek: DeepSeekAdapter,
}

/**
 * 获取适配器实例
 * @param {string} name - 适配器名称
 * @returns {import('./base-adapter.js').BaseAdapter}
 */
export function getAdapter(name) {
  const AdapterClass = adapters[name]
  if (!AdapterClass) {
    throw new Error(`未知适配器: ${name}。可用: ${Object.keys(adapters).join(', ')}`)
  }
  return new AdapterClass()
}

/**
 * 列出所有可用适配器
 */
export function listAdapters() {
  return Object.entries(adapters).map(([name, Cls]) => ({
    name,
    url: Cls.prototype.url || '',
  }))
}
