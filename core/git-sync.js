/**
 * GitHub 同步模块
 * 自动将 workspace 目录同步到 GitHub 仓库
 */
import simpleGit from 'simple-git'
import log from 'electron-log'
import { join } from 'path'

export class GitSync {
  /**
   * @param {object} config
   * @param {boolean} config.enabled
   * @param {string} config.token
   * @param {string} config.repo - 格式: username/repo-name
   * @param {string} config.branch
   * @param {string[]} config.syncDirs
   */
  constructor(config = {}, workspacePath) {
    this.config = config
    this._git = null
    // 优先使用传入的路径（来自 Electron userData），回退到 cwd
    this._workspacePath = workspacePath || join(process.cwd(), 'workspace')
  }

  /**
   * 初始化 Git 仓库
   */
  async init() {
    if (!this.config.enabled) return

    this._git = simpleGit(this._workspacePath)

    // 检查是否已初始化
    const isRepo = await this._git.checkIsRepo().catch(() => false)
    if (!isRepo) {
      await this._git.init()
      await this._git.addRemote('origin', this._getRemoteUrl())
      log.info('Git 仓库已初始化')
    }
  }

  /**
   * 同步到 GitHub
   */
  async sync() {
    if (!this.config.enabled || !this.config.token) {
      log.warn('GitHub 同步未启用或未配置 Token')
      return { success: false, message: 'GitHub 同步未启用' }
    }

    try {
      if (!this._git) await this.init()

      // 拉取最新
      try {
        await this._git.pull('origin', this.config.branch || 'main')
      } catch {
        // 首次可能没有远端分支
        log.info('首次同步，跳过 pull')
      }

      // 添加文件
      const syncDirs = this.config.syncDirs || ['conversations', 'projects', 'flows']
      for (const dir of syncDirs) {
        await this._git.add(join(this._workspacePath, dir)).catch(() => {})
      }

      // 检查是否有变更
      const status = await this._git.status()
      if (status.files.length === 0) {
        log.info('没有变更需要同步')
        return { success: true, message: '没有变更' }
      }

      // 提交
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await this._git.commit(`sync: ${timestamp}`, undefined, {
        '--author': '"MiMo Bot <bot@mimo.local>"',
      })

      // 推送
      await this._git.push('origin', this.config.branch || 'main')

      log.info(`GitHub 同步完成: ${status.files.length} 个文件`)
      return { success: true, message: `已同步 ${status.files.length} 个文件` }

    } catch (error) {
      log.error('GitHub 同步失败', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 获取同步状态
   */
  async status() {
    if (!this._git) await this.init()
    try {
      const status = await this._git.status()
      return {
        branch: status.current,
        modified: status.modified.length,
        created: status.created.length,
        deleted: status.deleted.length,
        files: status.files,
      }
    } catch {
      return { branch: 'N/A', modified: 0, created: 0, deleted: 0, files: [] }
    }
  }

  _getRemoteUrl() {
    const { token, repo } = this.config
    if (token && repo) {
      return `https://${token}@github.com/${repo}.git`
    }
    return ''
  }
}
