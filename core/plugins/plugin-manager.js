/**
 * 插件管理器
 * 扫描、加载、注册插件（节点、工具、适配器）
 * 支持依赖注入和生命周期管理
 */
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import log from 'electron-log'

export class PluginManager {
  /**
   * @param {string} pluginDir - 插件安装目录
   * @param {object} ctx - 依赖注入上下文
   */
  constructor(pluginDir, ctx = {}) {
    this.pluginDir = pluginDir
    this._ctx = ctx
    this._plugins = new Map() // name -> plugin
  }

  /**
   * 扫描插件目录
   */
  async scan() {
    try {
      const entries = await readdir(this.pluginDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = join(this.pluginDir, entry.name)
          try {
            await this.load(pluginPath)
          } catch (error) {
            log.error(`插件加载失败: ${entry.name}`, error)
          }
        }
      }

      log.info(`插件扫描完成，共加载 ${this._plugins.size} 个插件`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        log.info('插件目录不存在，跳过扫描')
      } else {
        log.error('插件扫描失败', error)
      }
    }
  }

  /**
   * 加载单个插件
   * @param {string} pluginPath - 插件目录路径
   */
  async load(pluginPath) {
    const manifestPath = join(pluginPath, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

    if (!manifest.name) {
      throw new Error('插件 manifest 缺少 name 字段')
    }

    // 动态加载插件模块
    const entryPath = join(pluginPath, manifest.entry || 'index.js')
    const plugin = await import(entryPath)
    const module = plugin.default || plugin

    const pluginInstance = {
      manifest,
      module,
      path: pluginPath,
      enabled: true,
    }

    // 生命周期: init
    if (typeof module.init === 'function') {
      try {
        await module.init(this._ctx)
        log.info(`插件已初始化: ${manifest.name}`)
      } catch (error) {
        log.error(`插件初始化失败: ${manifest.name}`, error)
        throw error
      }
    }

    this._plugins.set(manifest.name, pluginInstance)
    log.info(`插件已加载: ${manifest.name} v${manifest.version} [${manifest.type}]`)
  }

  /**
   * 卸载插件（带生命周期）
   */
  unload(name) {
    const plugin = this._plugins.get(name)
    if (!plugin) return

    // 生命周期: destroy
    if (typeof plugin.module.destroy === 'function') {
      try {
        plugin.module.destroy()
      } catch (error) {
        log.error(`插件销毁失败: ${name}`, error)
      }
    }

    this._plugins.delete(name)
    log.info(`插件已卸载: ${name}`)
  }

  /**
   * 启用插件
   */
  enable(name) {
    const plugin = this._plugins.get(name)
    if (plugin) {
      plugin.enabled = true
      log.info(`插件已启用: ${name}`)
    }
  }

  /**
   * 禁用插件
   */
  disable(name) {
    const plugin = this._plugins.get(name)
    if (plugin) {
      plugin.enabled = false
      log.info(`插件已禁用: ${name}`)
    }
  }

  /**
   * 从本地目录安装插件
   */
  async install(dirPath) {
    const manifestPath = join(dirPath, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

    // 复制到插件目录
    const { cp } = await import('fs/promises')
    const dest = join(this.pluginDir, manifest.name)
    await cp(dirPath, dest, { recursive: true })

    // 加载
    await this.load(dest)
    return { success: true, name: manifest.name }
  }

  /**
   * 卸载并删除插件
   */
  async uninstall(name) {
    this.unload(name)
    const { rm } = await import('fs/promises')
    const dir = join(this.pluginDir, name)
    await rm(dir, { recursive: true, force: true })
    log.info(`插件已删除: ${name}`)
  }

  /**
   * 获取所有插件信息
   */
  getPlugins() {
    return Array.from(this._plugins.entries()).map(([name, plugin]) => ({
      name,
      version: plugin.manifest.version,
      type: plugin.manifest.type,
      description: plugin.manifest.description,
      enabled: plugin.enabled,
    }))
  }

  /**
   * 获取指定类型的插件
   */
  getPluginsByType(type) {
    return Array.from(this._plugins.values())
      .filter(p => p.enabled && p.manifest.type === type)
  }

  /**
   * 获取节点实现（给 engine 用）
   */
  getNodeImplementation(nodeType) {
    const nodePlugins = this.getPluginsByType('node')
    for (const plugin of nodePlugins) {
      if (plugin.module[nodeType]) {
        return plugin.module[nodeType]
      }
    }
    return null
  }
}
