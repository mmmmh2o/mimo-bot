/**
 * 插件管理器
 * 扫描、加载、注册插件（节点、工具、适配器）
 */
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import log from 'electron-log'

export class PluginManager {
  /**
   * @param {string} pluginDir - 插件安装目录
   */
  constructor(pluginDir) {
    this.pluginDir = pluginDir
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
    // 读取 manifest.json
    const manifestPath = join(pluginPath, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

    if (!manifest.name) {
      throw new Error('插件 manifest 缺少 name 字段')
    }

    // 动态加载插件模块
    const entryPath = join(pluginPath, manifest.entry || 'index.js')
    const plugin = await import(entryPath)

    const pluginInstance = {
      manifest,
      module: plugin.default || plugin,
      path: pluginPath,
      enabled: true,
    }

    this._plugins.set(manifest.name, pluginInstance)
    log.info(`插件已加载: ${manifest.name} v${manifest.version}`)
  }

  /**
   * 卸载插件
   */
  unload(name) {
    this._plugins.delete(name)
    log.info(`插件已卸载: ${name}`)
  }

  /**
   * 获取所有插件
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
   * 获取节点实现
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
