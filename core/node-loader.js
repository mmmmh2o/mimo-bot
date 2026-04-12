/**
 * 节点加载器
 * 扫描 nodes/ 目录 + 数据库自定义节点
 */
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 为自定义节点创建执行函数
 * 每个自定义节点本质是一个 run-js，但字段从 manifest 动态注入
 */
function createCustomExecutor(customNode) {
  return {
    async execute(data, ctx) {
      // 把用户在表单里填的字段值注入到脚本的 $fields 对象
      let script = customNode.code
      const fieldValues = {}
      for (const f of (customNode.fields || [])) {
        fieldValues[f.key] = ctx.render(data[f.key] ?? f.default ?? '')
      }

      // 变量插值
      script = ctx.render(script)

      // 注入 $fields 和 $data
      const wrappedScript = `
        (function() {
          var $fields = ${JSON.stringify(fieldValues)};
          var $data = ${JSON.stringify(data)};
          ${script}
        })()
      `

      try {
        const result = await ctx.browser.executeJs(wrappedScript)
        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, result, 'runtime')
          ctx.emit('flow:variable-updated', { name: data.outputVariable, value: result })
        }
      } catch (error) {
        throw new Error(`自定义节点「${customNode.label}」执行失败: ${error.message}`)
      }
    }
  }
}

export class NodeLoader {
  constructor(nodesDir) {
    this.nodesDir = nodesDir || join(__dirname, '..', 'nodes')
    this._nodes = new Map()       // type -> { manifest, execute }
    this._customNodes = new Map() // type -> { manifest, execute, customNode }
  }

  /**
   * 扫描 nodes/ 目录，加载所有内置节点
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
      log.info(`节点扫描完成，共加载 ${this._nodes.size} 个内置节点类型`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        log.warn(`节点目录不存在: ${this.nodesDir}`)
      } else {
        log.error('节点扫描失败', error)
      }
    }
  }

  /**
   * 加载单个内置节点
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
   * 从数据库加载自定义节点
   */
  loadCustomNodes(db) {
    // 清除旧的自定义节点（包括引擎注册表中的）
    this._customNodes.clear()

    try {
      const rows = db.getCustomNodes()
      for (const row of rows) {
        const type = `custom-${row.id}`
        const manifest = {
          type,
          label: row.label,
          icon: row.icon || '🧩',
          group: row.group || '自定义',
          desc: row.description || '',
          defaults: this._buildDefaults(row.fields),
          fields: [
            ...(row.fields || []).map(f => ({
              key: f.key,
              label: f.label || f.key,
              type: f.type || 'text',
              placeholder: f.placeholder || '',
              ...(f.type === 'number' ? { min: f.min, max: f.max } : {}),
              ...(f.type === 'select' ? { options: f.options } : {}),
            })),
            { key: 'outputVariable', label: '输出变量名', type: 'text', placeholder: '可选，脚本 return 值存入此变量' },
            { key: 'continueOnError', label: '失败时继续', type: 'switch' },
          ],
        }
        const execute = createCustomExecutor(row)
        this._customNodes.set(type, { manifest, execute, customNode: row })
        log.info(`自定义节点已加载: ${type} (${row.label})`)
      }
      log.info(`自定义节点加载完成，共 ${this._customNodes.size} 个`)
    } catch (error) {
      log.error('自定义节点加载失败', error)
    }
  }

  /**
   * 从字段定义构建默认值
   */
  _buildDefaults(fields) {
    const defaults = { outputVariable: '', continueOnError: false }
    for (const f of (fields || [])) {
      defaults[f.key] = f.default ?? ''
    }
    return defaults
  }

  /**
   * 获取所有节点的 manifest（内置 + 自定义，给前端用）
   */
  getAllManifests() {
    const result = {}
    for (const [type, { manifest }] of this._nodes) {
      result[type] = manifest
    }
    for (const [type, { manifest }] of this._customNodes) {
      result[type] = manifest
    }
    return result
  }

  /**
   * 获取单个节点的执行函数
   */
  getExecute(type) {
    return this._nodes.get(type)?.execute || this._customNodes.get(type)?.execute || null
  }

  /**
   * 获取所有节点类型名
   */
  getTypes() {
    return [...this._nodes.keys(), ...this._customNodes.keys()]
  }

  /**
   * 注册到引擎（遍历所有节点：内置 + 自定义）
   */
  registerToEngine(engine) {
    for (const [type, { execute }] of this._nodes) {
      engine.registerNode(type, execute)
      log.info(`内置节点已注册到引擎: ${type}`)
    }
    for (const [type, { execute }] of this._customNodes) {
      engine.registerNode(type, execute)
      log.info(`自定义节点已注册到引擎: ${type}`)
    }
  }

  /**
   * 重新加载自定义节点（增删改后调用）
   */
  reloadCustomNodes(db, engine) {
    // 从引擎注销旧的自定义节点
    for (const type of this._customNodes.keys()) {
      engine.unregisterNode?.(type)
    }
    // 重新加载
    this.loadCustomNodes(db)
    // 注册到引擎
    for (const [type, { execute }] of this._customNodes) {
      engine.registerNode(type, execute)
    }
  }
}
