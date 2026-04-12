/**
 * 节点加载器
 * 扫描 nodes/ 目录，加载所有节点的 manifest.json + execute.js
 */
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class NodeLoader {
  constructor(nodesDir) {
    this.nodesDir = nodesDir || join(__dirname, '..', 'nodes')
    this._nodes = new Map() // type -> { manifest, execute }
  }

  /**
   * 扫描 nodes/ 目录，加载所有节点
   */
  async scan() {
    this._nodes.clear()
    try {
      const entries = await readdir(this.nodesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const nodePath = join(this.nodesDir, entry.name)
        try {
          await this._loadNode(nodePath)
        } catch (error) {
          log.error(`节点加载失败: ${entry.name}`, error)
        }
      }
      log.info(`节点扫描完成，共加载 ${this._nodes.size} 个节点类型`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        log.warn(`节点目录不存在: ${this.nodesDir}`)
      } else {
        log.error('节点扫描失败', error)
      }
    }
  }

  /**
   * 加载单个节点
   */
  async _loadNode(nodePath) {
    const manifestPath = join(nodePath, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

    if (!manifest.type) {
      throw new Error(`节点 manifest 缺少 type 字段: ${nodePath}`)
    }

    const executePath = join(nodePath, 'execute.js')
    const module = await import(executePath)
    const execute = module.default || module

    this._nodes.set(manifest.type, { manifest, execute })
    log.info(`节点已加载: ${manifest.type} (${manifest.label})`)
  }

  /**
   * 获取所有节点的 manifest（给前端用）
   */
  getAllManifests() {
    const result = {}
    for (const [type, { manifest }] of this._nodes) {
      result[type] = manifest
    }
    return result
  }

  /**
   * 获取单个节点的执行函数
   */
  getExecute(type) {
    return this._nodes.get(type)?.execute || null
  }

  /**
   * 获取所有节点类型名
   */
  getTypes() {
    return Array.from(this._nodes.keys())
  }

  /**
   * 注册到引擎（遍历所有节点）
   */
  registerToEngine(engine) {
    for (const [type, { execute }] of this._nodes) {
      engine.registerNode(type, execute)
      log.info(`节点已注册到引擎: ${type}`)
    }
  }
}
