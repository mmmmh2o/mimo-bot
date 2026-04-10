/**
 * 流程执行引擎
 * 解析流程定义，按节点拓扑排序执行，管理变量和状态
 */
import log from 'electron-log'

export class FlowExecutionError extends Error {
  constructor(flowId, nodeId, cause) {
    super(`流程 ${flowId} 在节点 ${nodeId} 执行失败: ${cause?.message || cause}`)
    this.name = 'FlowExecutionError'
    this.flowId = flowId
    this.nodeId = nodeId
    this.cause = cause
  }
}

export class FlowEngine {
  /**
   * @param {object} deps
   * @param {import('./browser-controller.js').BrowserController} deps.browserController
   * @param {import('./variables.js').VariableEngine} deps.variableEngine
   * @param {import('./database.js').Database} deps.db
   * @param {function} deps.onEvent - 事件回调 (推送到渲染进程)
   */
  constructor({ browserController, variableEngine, db, onEvent }) {
    this.browser = browserController
    this.variables = variableEngine
    this.db = db
    this.onEvent = onEvent

    this._running = false
    this._paused = false
    this._stopRequested = false
    this._currentFlow = null
    this._currentNodeId = null
    this._step = 0
    this._totalSteps = 0
  }

  /**
   * 运行指定流程
   * @param {string} flowId - 流程 ID
   */
  async run(flowId) {
    if (this._running) {
      throw new Error('已有流程在运行中，请先停止')
    }

    this._running = true
    this._stopRequested = false
    this._paused = false
    this._step = 0

    try {
      // 加载流程定义
      const flow = await this.db.getFlow(flowId)
      if (!flow) throw new Error(`流程 ${flowId} 不存在`)

      this._currentFlow = flow
      const { nodes, edges, variables: flowVars } = flow

      // 拓扑排序
      const sortedNodes = this._topologicalSort(nodes, edges)
      this._totalSteps = sortedNodes.length

      // 初始化变量
      this.variables.reset()
      if (flowVars) {
        for (const [name, config] of Object.entries(flowVars)) {
          this.variables.set(name, config.value, config.scope)
        }
      }

      // 确保浏览器已打开
      await this.browser.ensureReady()

      log.info(`流程 "${flow.name}" 开始执行`, { flowId, nodeCount: sortedNodes.length })
      this._emit('flow:started', { flowId, name: flow.name, totalSteps: this._totalSteps })

      // 逐节点执行
      for (const node of sortedNodes) {
        if (this._stopRequested) {
          log.info('用户请求终止流程')
          break
        }

        // 等待暂停恢复
        while (this._paused && !this._stopRequested) {
          await this._sleep(500)
        }

        this._currentNodeId = node.id
        this._step++

        this._emit('flow:node-started', {
          nodeId: node.id,
          nodeType: node.type,
          step: this._step,
          total: this._totalSteps,
        })

        try {
          await this._executeNode(node)
          this._emit('flow:node-completed', {
            nodeId: node.id,
            step: this._step,
            total: this._totalSteps,
          })
        } catch (error) {
          log.error(`节点 ${node.id} 执行失败`, error)
          this._emit('flow:node-error', {
            nodeId: node.id,
            error: error.message,
          })
          throw new FlowExecutionError(flowId, node.id, error)
        }
      }

      // 流程完成
      this._emit('flow:completed', {
        flowId,
        variables: this.variables.exportAll(),
      })
      log.info(`流程 "${flow.name}" 执行完成`)

    } catch (error) {
      log.error('流程执行出错', error)
      this._emit('flow:error', { error: error.message })
    } finally {
      this._running = false
      this._currentFlow = null
      this._currentNodeId = null
    }
  }

  pause() {
    this._paused = true
    this._emit('flow:paused', {})
    log.info('流程已暂停')
  }

  resume() {
    this._paused = false
    this._emit('flow:resumed', {})
    log.info('流程已恢复')
  }

  stop() {
    this._stopRequested = true
    this._paused = false
    log.info('流程终止请求已发送')
  }

  getStatus() {
    return {
      running: this._running,
      paused: this._paused,
      flowId: this._currentFlow?.id,
      flowName: this._currentFlow?.name,
      currentNodeId: this._currentNodeId,
      step: this._step,
      totalSteps: this._totalSteps,
    }
  }

  /**
   * 执行单个节点
   * @param {object} node
   */
  async _executeNode(node) {
    const data = node.data || {}

    // 渲染模板变量
    const render = (template) => {
      if (typeof template !== 'string') return template
      return this.variables.render(template)
    }

    switch (node.type) {
      case 'start':
        // 设置输入变量
        if (data.inputVariables) {
          for (const [k, v] of Object.entries(data.inputVariables)) {
            this.variables.set(k, render(v), 'input')
          }
        }
        break

      case 'send-message': {
        const content = render(data.content)
        await this.browser.sendMessage(content, {
          typingSpeed: data.typingSpeed || [50, 150],
          delayBeforeSend: data.delayBeforeSend || [1000, 3000],
        })

        if (data.waitForReply) {
          const reply = await this.browser.waitForReply({
            timeout: data.timeout || 120,
          })
          if (data.outputVariable) {
            this.variables.set(data.outputVariable, reply, 'runtime')
          }
        }
        break
      }

      case 'wait-reply': {
        const reply = await this.browser.waitForReply({
          timeout: data.timeout || 120,
        })
        if (data.outputVariable) {
          this.variables.set(data.outputVariable, reply, 'runtime')
        }
        break
      }

      case 'extract': {
        const source = this.variables.get(data.sourceVariable) || ''
        if (data.rules) {
          for (const rule of data.rules) {
            let extracted = null
            if (rule.type === 'regex') {
              const match = source.match(new RegExp(rule.pattern, 's'))
              extracted = match ? match[1] || match[0] : null
            } else if (rule.type === 'code-block') {
              const lang = rule.language || '\\w+'
              const re = new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``, 's')
              const match = source.match(re)
              extracted = match ? match[1] : null
            }
            if (extracted !== null) {
              this.variables.set(rule.variable, extracted, rule.dataType || 'string')
              this._emit('flow:variable-updated', { name: rule.variable, value: extracted })
            }
          }
        }
        break
      }

      case 'condition': {
        // 条件分支节点不直接执行动作，由引擎根据 edges 决定路径
        // 这里只做条件判断
        const sourceValue = this.variables.get(data.sourceVariable) || ''
        const result = this._evaluateCondition(sourceValue, data.condition)
        this.variables.set(`__branch_${node.id}`, result, 'runtime')
        break
      }

      case 'loop': {
        // 循环在流程图层面处理，这里处理单次迭代
        const items = this.variables.get(data.sourceVariable) || []
        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i++) {
            this.variables.set(data.itemVariable || 'item', items[i], 'runtime')
            this.variables.set(data.indexVariable || 'index', i, 'runtime')
            // 循环体在流程图中由 edges 连接
          }
        }
        break
      }

      case 'read-file': {
        const fs = await import('fs/promises')
        const filePath = render(data.path)
        const content = await fs.readFile(filePath, 'utf-8')
        if (data.outputVariable) {
          this.variables.set(data.outputVariable, content, 'runtime')
        }
        break
      }

      case 'save': {
        const fs = await import('fs/promises')
        const path = await import('path')
        const value = this.variables.get(data.variable) || ''
        const filePath = render(data.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, value, 'utf-8')
        log.info(`文件已保存: ${filePath}`)
        break
      }

      case 'set-variable': {
        this.variables.set(data.name, render(data.value), data.scope || 'runtime')
        this._emit('flow:variable-updated', { name: data.name, value: data.value })
        break
      }

      case 'human-handoff': {
        this._paused = true
        this._emit('flow:waiting-input', {
          nodeId: node.id,
          message: data.message || '需要人工介入',
        })
        while (this._paused && !this._stopRequested) {
          await this._sleep(500)
        }
        break
      }

      case 'delay': {
        const seconds = data.seconds || 5
        await this._sleep(seconds * 1000)
        break
      }

      case 'end':
        break

      default:
        // 尝试从插件系统中查找节点实现
        log.warn(`未知节点类型: ${node.type}`)
        break
    }
  }

  /**
   * 评估条件
   */
  _evaluateCondition(value, condition) {
    const { type, operator, target } = condition
    switch (type) {
      case 'contains':
        return value.includes(target)
      case 'not-contains':
        return !value.includes(target)
      case 'equals':
        return value === target
      case 'regex':
        return new RegExp(target).test(value)
      case 'greater-than':
        return Number(value) > Number(target)
      case 'less-than':
        return Number(value) < Number(target)
      default:
        return false
    }
  }

  /**
   * 拓扑排序
   */
  _topologicalSort(nodes, edges) {
    const inDegree = new Map()
    const adjList = new Map()

    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    for (const edge of edges) {
      adjList.get(edge.source)?.push(edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }

    const queue = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const sorted = []
    while (queue.length > 0) {
      const current = queue.shift()
      sorted.push(current)
      for (const neighbor of adjList.get(current) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1)
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor)
        }
      }
    }

    return sorted.map(id => nodes.find(n => n.id === id)).filter(Boolean)
  }

  _emit(type, data) {
    this.onEvent?.({ type, data })
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
