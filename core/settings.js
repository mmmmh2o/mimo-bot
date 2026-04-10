/**
 * 设置管理器
 * JSON 文件持久化应用设置
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import log from 'electron-log'

const DEFAULT_SETTINGS = {
  browser: {
    adapter: 'mimo',
    url: 'https://platform.xiaomimimo.com',
    timeout: 60000,
    slowMo: 500,
    cookieSaved: false,
  },
  conversation: {
    delayMin: 3,
    delayMax: 8,
    pauseMin: 1,
    pauseMax: 3,
    typingMin: 50,
    typingMax: 150,
    replyTimeout: 120,
    streamDetection: true,
    detectStrategy: 'dom-stable',
    customSelector: '',
  },
  github: {
    enabled: false,
    token: '',
    repo: '',
    branch: 'main',
    strategy: 'after-run',
    syncDirs: ['conversations', 'projects', 'flows'],
  },
  notify: {
    desktopOnComplete: true,
    desktopOnFail: true,
    desktopOnHandoff: true,
    webhookOnComplete: '',
    webhookOnFail: '',
  },
  schedules: [],
  extensions: [],
}

export class SettingsManager {
  constructor(filePath) {
    this.filePath = filePath
    this._settings = { ...DEFAULT_SETTINGS }
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const loaded = JSON.parse(raw)
      this._settings = this._deepMerge({ ...DEFAULT_SETTINGS }, loaded)
      log.info('设置已加载')
    } catch (error) {
      if (error.code === 'ENOENT') {
        log.info('设置文件不存在，使用默认设置')
        await this.save()
      } else {
        log.error('设置加载失败', error)
      }
    }
  }

  async save() {
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this._settings, null, 2))
      log.info('设置已保存')
    } catch (error) {
      log.error('设置保存失败', error)
    }
  }

  get(key) {
    return key ? this._settings[key] : this._settings
  }

  set(key, value) {
    this._settings[key] = value
  }

  getAll() {
    return { ...this._settings }
  }

  async setAll(settings) {
    this._settings = this._deepMerge({ ...DEFAULT_SETTINGS }, settings)
    await this.save()
  }

  reset() {
    this._settings = { ...DEFAULT_SETTINGS }
  }

  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = this._deepMerge(target[key] || {}, source[key])
      } else {
        target[key] = source[key]
      }
    }
    return target
  }
}
