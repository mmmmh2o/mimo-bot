/**
 * Electron 预加载脚本
 * 暴露安全的 IPC 接口给渲染进程
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  /**
   * 调用主进程方法
   * @param {string} channel - IPC 通道名
   * @param  {...any} args - 参数
   * @returns {Promise<any>}
   */
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  /**
   * 监听主进程推送事件
   * @param {string} event - 事件名
   * @param {function} callback - 回调
   * @returns {function} 取消监听的函数
   */
  on: (event, callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on(event, handler)
    return () => ipcRenderer.removeListener(event, handler)
  },

  /**
   * 移除事件监听
   */
  off: (event, callback) => {
    ipcRenderer.removeListener(event, callback)
  },
})
