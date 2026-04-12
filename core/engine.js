/**
 * 流程执行引擎
 * 解析流程定义，按节点拓扑排序执行，管理变量和状态
 * 节点执行走插件注册表，新增节点不动核心代码
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

export class UnknownNodeTypeError extends Error {
  constructor(nodeType) {
    super(`未知节点类型: ${nodeType}`)
    this.name = 'UnknownNodeTypeError'
    this.nodeType = nodeType
  }
}

export class FlowEngine {
  /**
   * @param {object} deps
   * @param {import('./browser-controller.js').BrowserController} deps.browserController
   * @param {import('./variables.js').VariableEngine} deps.variableEngine
   * @param {import('./database.js').Database} deps.db
   * @param {function} deps.onEvent - 事件回调
   */
  constructor({ browserController, variableEngine, db, onEvent }) {
    this.browser = browserController
    this.variables = variableEngine
    this.db = db
    this.onEvent = onEvent
    this._pluginManager = null

    // 内置节点注册表
    this._nodeRegistry = new Map()

    this._running = false
    this._paused = false
    this._stopRequested = false
    this._currentFlow = null
    this._currentNodeId = null
    this._step = 0
    this._totalSteps = 0
  }

  /**
   * 注册插件管理器中的节点类型
   */
  registerPlugins(pluginManager) {
    this._pluginManager = pluginManager
    const nodePlugins = pluginManager.getPluginsByType('node')
    for (const plugin of nodePlugins) {
      for (const [type, impl] of Object.entries(plugin.module)) {
        if (typeof impl?.execute === 'function') {
          this._nodeRegistry.set(type, impl)
          log.info(`插件节点已注册: ${type} (来自 ${plugin.manifest.name})`)
        }
      }
    }
  }

  /**
   * 手动注册节点类型
   */
  registerNode(type, implementation) {
    this._nodeRegistry.set(type, implementation)
  }

  /**
   * 注销节点类型
   */
  unregisterNode(type) {
    this._nodeRegistry.delete(type)
  }

  /**
   * 运行指定流程
   */
  async run(flowId, inputVars) {
    if (this._running) {
      throw new Error('已有流程在运行中，请先停止')
    }

    this._running = true
    this._stopRequested = false
    this._paused = false
    this._step = 0

    try {
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
      // 外部传入的输入变量
      if (inputVars) {
        for (const [name, value] of Object.entries(inputVars)) {
          this.variables.set(name, value, 'input')
        }
      }

      // 确保浏览器已就绪
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
          // 如果节点配置了 continueOnError，跳过继续
          if (node.data?.continueOnError) {
            log.warn(`节点 ${node.id} 配置了 continueOnError，跳过`)
            continue
          }
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
   * 执行单个节点 — 走注册表而非 switch
   */
  async _executeNode(node) {
    const handler = this._nodeRegistry.get(node.type)
    if (!handler) {
      throw new UnknownNodeTypeError(node.type)
    }

    // 构建执行上下文
    const ctx = {
      variables: this.variables,
      browser: this.browser,
      db: this.db,
      emit: (event, data) => this._emit(event, data),
      log,
      render: (template) => {
        if (typeof template !== 'string') return template
        return this.variables.render(template)
      },
    }

    await handler.execute(node.data, ctx)
  }

  /**
   * 注册内置节点类型
   * 节点逻辑现在由 NodeLoader 从 nodes/ 目录加载
   */
  _registerBuiltinNodes() {
    // 节点定义已移至 nodes/ 目录，由 NodeLoader.scan() + registerToEngine() 加载
  }

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

// 辅助函数已移至各节点的 execute.js 中
