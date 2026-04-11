/**
 * 自动更新模块 — Full / Lite 双包策略
 *
 * 策略：
 *   首次安装 → 下载 FULL 包（含 Chromium，~150MB）
 *   后续更新 → 检测本地已有 Chromium → 只下载 LITE 包（~20MB）
 *   Lite 更新后 → 检查 Chromium 兼容性，不兼容则自动重装
 *
 * GitHub Release 结构：
 *   MiMo-Bot-1.0.0-full-setup.exe   ← 首次下载
 *   MiMo-Bot-1.1.0-lite-setup.exe   ← 更新下载
 */

import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// ---- 判断是否已安装 Chromium ----
function hasLocalBrowser() {
  const paths = [
    join(app.getPath('userData'), 'chromium'),
    join(process.resourcesPath, 'chromium'),
  ]
  return paths.some(p => existsSync(p))
}

// ---- 渲染进程通信 ----
function sendToRenderer(mainWindow, channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

/**
 * 初始化自动更新
 */
export function initUpdater(mainWindow) {
  const hasBrowser = hasLocalBrowser()
  log.info(`[Updater] 本地浏览器: ${hasBrowser ? '已存在' : '未找到'}`)

  // 根据本地状态选择更新通道
  // 有浏览器 → 用 lite 通道（不含浏览器）
  // 没浏览器 → 用 full 通道（含浏览器）
  if (hasBrowser) {
    autoUpdater.channel = 'lite'
    log.info('[Updater] 使用 lite 更新通道（不含浏览器）')
  } else {
    autoUpdater.channel = 'latest'  // full 版走默认通道
    log.info('[Updater] 使用 full 更新通道（含浏览器）')
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // ---- 事件转发 ----

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] 检查更新中...')
    sendToRenderer(mainWindow, 'updater:checking', { channel: autoUpdater.channel })
  })

  autoUpdater.on('update-available', (info) => {
    const isLite = autoUpdater.channel === 'lite'
    log.info(`[Updater] 发现新版本: ${info.version} (${isLite ? 'lite' : 'full'})`)
    sendToRenderer(mainWindow, 'updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      variant: isLite ? 'lite' : 'full',
      sizeHint: isLite ? '~20MB' : '~150MB',
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] 当前已是最新版本')
    sendToRenderer(mainWindow, 'updater:not-available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent)
    const transferred = Math.round(progress.transferred / 1024 / 1024 * 10) / 10
    const total = Math.round(progress.total / 1024 / 1024 * 10) / 10
    const speed = Math.round(progress.bytesPerSecond / 1024 / 1024 * 10) / 10
    if (percent % 10 === 0) {
      log.info(`[Updater] 下载: ${percent}% (${transferred}/${total} MB, ${speed} MB/s)`)
    }
    sendToRenderer(mainWindow, 'updater:progress', { percent, transferred, total, speed })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const isLite = autoUpdater.channel === 'lite'
    log.info(`[Updater] 下载完成: ${info.version}`)

    // Lite 更新后，检查 Chromium 是否需要重装
    if (isLite) {
      log.info('[Updater] Lite 更新完成，Chromium 保留不动')
    }

    sendToRenderer(mainWindow, 'updater:downloaded', {
      version: info.version,
      variant: isLite ? 'lite' : 'full',
      message: '更新已就绪，重启后生效',
    })
  })

  autoUpdater.on('error', (error) => {
    log.error('[Updater] 错误:', error.message)

    // Lite 更新失败 → 尝试回退到 full
    if (autoUpdater.channel === 'lite') {
      log.warn('[Updater] Lite 更新失败，回退到 full 通道...')
      autoUpdater.channel = 'latest'
      sendToRenderer(mainWindow, 'updater:fallback', {
        message: '轻量更新失败，切换到完整包下载...',
      })
      // 不自动重试，让用户决定
    }

    sendToRenderer(mainWindow, 'updater:error', { message: error.message })
  })

  // ---- IPC 注册 ----
  const { ipcMain } = require('electron')

  ipcMain.handle('updater:check', async () => {
    const result = await autoUpdater.checkForUpdates()
    return {
      updateInfo: result?.updateInfo ? {
        version: result.updateInfo.version,
        releaseDate: result.updateInfo.releaseDate,
      } : null,
      channel: autoUpdater.channel,
    }
  })

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate()
    return { success: true }
  })

  ipcMain.handle('updater:install', () => {
    log.info('[Updater] 重启安装更新...')
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('updater:getVersion', () => ({
    current: app.getVersion(),
    channel: autoUpdater.channel,
    hasBrowser: hasLocalBrowser(),
    variant: hasLocalBrowser() ? 'lite' : 'full',
  }))

  // 手动切换通道（调试用）
  ipcMain.handle('updater:setChannel', (_, channel) => {
    autoUpdater.channel = channel
    log.info(`[Updater] 通道已切换: ${channel}`)
    return { channel }
  })

  log.info('[Updater] 初始化完成')
}

/**
 * 启动后静默检查
 */
export function checkOnStartup() {
  setTimeout(() => {
    log.info('[Updater] 启动后自动检查...')
    autoUpdater.checkForUpdates().catch(err => {
      log.warn('[Updater] 自动检查失败:', err.message)
    })
  }, 10000)
}
