/**
 * 变量引擎
 * 管理流程中的变量：注入、提取、渲染模板、类型转换
 */
import log from 'electron-log'

export class VariableError extends Error {
  constructor(variableName, message) {
    super(`变量 ${variableName}: ${message}`)
    this.name = 'VariableError'
    this.variableName = variableName
  }
}

export class VariableEngine {
  constructor(db) {
    this.db = db
    this._variables = new Map()
    this._types = new Map()
    this._scopes = new Map()
  }

  /**
   * 设置变量
   * @param {string} name - 变量名
   * @param {any} value - 值
   * @param {string} scope - 作用域 (input|runtime|output|persistent)
   * @param {string} type - 类型 (string|number|boolean|array|object|file|code)
   */
  set(name, value, scope = 'runtime', type = null) {
    this._variables.set(name, value)
    this._scopes.set(name, scope)
    if (type) {
      this._types.set(name, type)
    } else {
      this._types.set(name, this._inferType(value))
    }

    // 持久化变量存入数据库
    if (scope === 'persistent' || scope === 'input') {
      this.db?.setVariable(name, value, scope, type)
    }

    log.debug(`变量设置: ${name} = ${JSON.stringify(value).slice(0, 100)}`)
  }

  /**
   * 获取变量
   * @param {string} name
   * @returns {any}
   */
  get(name) {
    // 系统变量
    if (name === '$now') return new Date().toISOString()
    if (name === '$date') return new Date().toISOString().split('T')[0]
    if (name === '$time') return new Date().toTimeString().split(' ')[0]
    if (name === '$timestamp') return Date.now()

    return this._variables.get(name)
  }

  /**
   * 模板渲染
   * 将 "{{变量名}}" 替换为变量值
   * 支持管道: {{var | filter}}
   * 
   * @param {string} template
   * @returns {string}
   */
  render(template) {
    if (typeof template !== 'string') return template

    return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      const parts = expr.trim().split('|').map(s => s.trim())
      const varName = parts[0]
      const filters = parts.slice(1)

      let value = this.get(varName)

      // 应用过滤器
      for (const filter of filters) {
        value = this._applyFilter(value, filter)
      }

      if (value === undefined || value === null) {
        log.warn(`变量未定义: ${varName}`)
        return `{{${varName}}}`
      }

      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2)
      }

      return String(value)
    })
  }

  /**
   * 从文本中提取变量（正则匹配）
   * @param {string} text - 源文本
   * @param {string} pattern - 正则表达式
   * @param {string} varName - 存储到的变量名
   * @returns {boolean} 是否提取成功
   */
  extract(text, pattern, varName) {
    try {
      const match = text.match(new RegExp(pattern, 's'))
      if (match) {
        const value = match[1] || match[0]
        this.set(varName, value, 'runtime')
        return true
      }
      return false
    } catch (error) {
      log.error(`变量提取失败: ${varName}`, error)
      return false
    }
  }

  /**
   * 删除变量
   */
  delete(name) {
    this._variables.delete(name)
    this._types.delete(name)
    this._scopes.delete(name)
  }

  /**
   * 导出所有变量
   */
  exportAll() {
    const result = {}
    for (const [name, value] of this._variables) {
      result[name] = {
        value,
        type: this._types.get(name),
        scope: this._scopes.get(name),
      }
    }
    return result
  }

  /**
   * 重置运行时变量（保留输入变量和持久化变量）
   */
  reset() {
    for (const [name, scope] of this._scopes) {
      if (scope === 'runtime' || scope === 'output') {
        this._variables.delete(name)
        this._types.delete(name)
        this._scopes.delete(name)
      }
    }
  }

  /**
   * 获取所有变量列表
   */
  list() {
    const list = []
    for (const [name, value] of this._variables) {
      list.push({
        name,
        value,
        type: this._types.get(name),
        scope: this._scopes.get(name),
      })
    }
    return list
  }

  // ---- 私有方法 ----

  _inferType(value) {
    if (Array.isArray(value)) return 'array'
    if (value === null || value === undefined) return 'string'
    return typeof value
  }

  _applyFilter(value, filter) {
    const [filterName, ...args] = filter.split(':')
    const arg = args.join(':')

    switch (filterName) {
      case 'upper':
        return String(value).toUpperCase()
      case 'lower':
        return String(value).toLowerCase()
      case 'trim':
        return String(value).trim()
      case 'length':
        return Array.isArray(value) ? value.length : String(value).length
      case 'first':
        return Array.isArray(value) ? value[0] : String(value)[0]
      case 'last':
        return Array.isArray(value) ? value[value.length - 1] : String(value).slice(-1)
      case 'json':
        try { return JSON.parse(value) } catch { return value }
      case 'jsonstring':
        try { return JSON.stringify(value) } catch { return String(value) }
      case 'extract_code':
        const codeMatch = String(value).match(/```[\w]*\n([\s\S]*?)```/s)
        return codeMatch ? codeMatch[1] : value
      case 'extract_json':
        const jsonMatch = String(value).match(/\{[\s\S]*\}/s)
        try { return jsonMatch ? JSON.parse(jsonMatch[0]) : null } catch { return null }
      case 'split_lines':
        return String(value).split('\n').filter(Boolean)
      case 'slice':
        const [start, end] = arg.split(',').map(Number)
        return String(value).slice(start, end || undefined)
      case 'default':
        return (value === undefined || value === null || value === '') ? arg : value
      default:
        log.warn(`未知过滤器: ${filterName}`)
        return value
    }
  }
}
