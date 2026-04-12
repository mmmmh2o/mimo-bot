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
    this._registerBuiltinNodes()

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
   */
  _registerBuiltinNodes() {
    // 开始节点
    this._nodeRegistry.set('start', {
      type: 'start',
      async execute(data, ctx) {
        if (data.inputVariables) {
          for (const [k, v] of Object.entries(data.inputVariables)) {
            ctx.variables.set(k, ctx.render(v), 'input')
          }
        }
      },
    })

    // 发送消息
    this._nodeRegistry.set('send-message', {
      type: 'send-message',
      async execute(data, ctx) {
        const content = ctx.render(data.content)

        if (data.mode === 'custom') {
          // 自定义模式：直接操作用户指定的元素
          await executeCustomSend(data, ctx, content)
        } else {
          // 适配器模式（默认）
          await ctx.browser.sendMessage(content, {
            typingSpeed: data.typingSpeed || [50, 150],
            delayBeforeSend: data.delayBeforeSend || [1000, 3000],
          })

          if (data.waitForReply) {
            const reply = await ctx.browser.waitForReply({
              timeout: data.timeout || 120,
            })
            if (data.outputVariable) {
              ctx.variables.set(data.outputVariable, reply, 'runtime')
            }
            saveConversation(ctx, data, content, reply)
          }
        }
      },
    })

    // 等待回复
    this._nodeRegistry.set('wait-reply', {
      type: 'wait-reply',
      async execute(data, ctx) {
        let reply
        if (data.mode === 'custom' && data.replySelector) {
          // 自定义模式：监听指定选择器
          const sel = ctx.render(data.replySelector)
          reply = await ctx.browser.waitForAndGetText(sel, {
            timeout: data.timeout || 120,
          })
        } else {
          // 适配器模式（默认）
          reply = await ctx.browser.waitForReply({
            timeout: data.timeout || 120,
          })
        }
        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, reply, 'runtime')
        }
      },
    })

    // 提取变量
    this._nodeRegistry.set('extract', {
      type: 'extract',
      async execute(data, ctx) {
        const source = ctx.variables.get(data.sourceVariable) || ''
        if (!data.rules) return

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
            ctx.variables.set(rule.variable, extracted, rule.dataType || 'string')
            ctx.emit('flow:variable-updated', { name: rule.variable, value: extracted })
          }
        }
      },
    })

    // 条件分支
    this._nodeRegistry.set('condition', {
      type: 'condition',
      async execute(data, ctx) {
        const sourceValue = ctx.variables.get(data.sourceVariable) || ''
        const result = evaluateCondition(sourceValue, data.condition)
        ctx.variables.set(`__branch_${data.id}`, result, 'runtime')
      },
    })

    // 循环
    this._nodeRegistry.set('loop', {
      type: 'loop',
      async execute(data, ctx) {
        const items = ctx.variables.get(data.sourceVariable) || []
        if (!Array.isArray(items)) return
        const max = data.maxIterations || items.length
        for (let i = 0; i < Math.min(items.length, max); i++) {
          ctx.variables.set(data.itemVariable || 'item', items[i], 'runtime')
          ctx.variables.set(data.indexVariable || 'index', i, 'runtime')
        }
      },
    })

    // 读取文件
    this._nodeRegistry.set('read-file', {
      type: 'read-file',
      async execute(data, ctx) {
        const fs = await import('fs/promises')
        const filePath = ctx.render(data.path)
        const content = await fs.readFile(filePath, data.encoding || 'utf-8')
        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, content, 'runtime')
        }
      },
    })

    // 保存文件
    this._nodeRegistry.set('save', {
      type: 'save',
      async execute(data, ctx) {
        const fs = await import('fs/promises')
        const path = await import('path')
        const value = ctx.variables.get(data.variable) || ''
        const filePath = ctx.render(data.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        if (data.append) {
          await fs.appendFile(filePath, value, 'utf-8')
        } else {
          await fs.writeFile(filePath, value, 'utf-8')
        }
        log.info(`文件已保存: ${filePath}`)
      },
    })

    // 设置变量
    this._nodeRegistry.set('set-variable', {
      type: 'set-variable',
      async execute(data, ctx) {
        ctx.variables.set(data.name, ctx.render(data.value), data.scope || 'runtime')
        ctx.emit('flow:variable-updated', { name: data.name, value: data.value })
      },
    })

    // 运行命令
    this._nodeRegistry.set('run-command', {
      type: 'run-command',
      async execute(data, ctx) {
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        const command = ctx.render(data.command)
        const cwd = data.workingDir ? ctx.render(data.workingDir) : process.cwd()
        const timeout = (data.timeout || 60) * 1000

        const { stdout, stderr } = await execAsync(command, { cwd, timeout })
        const output = stdout || stderr

        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, output, 'runtime')
        }
      },
    })

    // 执行页面 JS
    this._nodeRegistry.set('run-js', {
      type: 'run-js',
      async execute(data, ctx) {
        let script = ctx.render(data.code || '')
        if (!script) throw new Error('run-js: 未配置代码')

        // 如果指定了选择器，把匹配到的元素作为 $el 注入
        if (data.selector) {
          const sel = ctx.render(data.selector)
          const wrapScript = `
            (function() {
              const $els = document.querySelectorAll(${JSON.stringify(sel)});
              const $el = $els[0] || null;
              ${script}
            })()
          `
          script = wrapScript
        } else {
          // 包装为 IIFE 确保返回值
          script = `(function() { ${script} })()`
        }

        const timeout = (data.timeout || 30) * 1000
        const result = await ctx.browser.executeJs(script)

        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, result, 'runtime')
          ctx.emit('flow:variable-updated', { name: data.outputVariable, value: result })
        }

        log.info(`run-js 完成${data.selector ? ` (selector: ${data.selector})` : ''}`)
      },
    })

    // 人工介入
    this._nodeRegistry.set('human-handoff', {
      type: 'human-handoff',
      async execute(data, ctx) {
        ctx.emit('flow:waiting-input', {
          message: data.message || '需要人工介入',
        })
        // 等待外部 resume
        while (true) {
          await new Promise(r => setTimeout(r, 500))
          // 检查是否已恢复（通过外部设置的标志）
          if (!this._paused) break
        }
      },
    })

    // 延时
    this._nodeRegistry.set('delay', {
      type: 'delay',
      async execute(data) {
        const seconds = data.seconds || 5
        await new Promise(resolve => setTimeout(resolve, seconds * 1000))
      },
    })

    // 结束
    this._nodeRegistry.set('end', {
      type: 'end',
      async execute() { /* 流程终点 */ },
    })
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

// ---- 自定义发送辅助 ----

async function executeCustomSend(data, ctx, content) {
  const inputSel = ctx.render(data.inputSelector)
  const sendMethod = data.sendMethod || 'click'
  const sendSel = data.sendSelector ? ctx.render(data.sendSelector) : null
  const inputMethod = data.inputMethod || 'type'

  if (!inputSel) throw new Error('自定义模式：未配置输入目标选择器')

  // 填入内容
  if (inputMethod === 'fill') {
    await ctx.browser.fill(inputSel, content)
  } else {
    await ctx.browser.type(inputSel, content, {
      typingSpeed: data.typingSpeed || [50, 150],
    })
  }

  // 发送前延迟（模拟人类）
  const delayRange = data.delayBeforeSend || [500, 1500]
  const delay = Array.isArray(delayRange)
    ? delayRange[0] + Math.random() * (delayRange[1] - delayRange[0])
    : delayRange
  await new Promise(r => setTimeout(r, delay))

  // 发送
  if (sendMethod === 'click' && sendSel) {
    await ctx.browser.click(sendSel)
  } else if (sendMethod === 'enter') {
    await ctx.browser.pressEnter(inputSel)
  } else if (sendMethod === 'both' && sendSel) {
    await ctx.browser.pressEnter(inputSel)
    await new Promise(r => setTimeout(r, 300))
    await ctx.browser.click(sendSel)
  }

  log.info(`自定义发送完成: input=${inputSel}, method=${sendMethod}`)

  // 等待回复
  if (data.waitForReply && data.replySelector) {
    const replySel = ctx.render(data.replySelector)
    const reply = await ctx.browser.waitForAndGetText(replySel, {
      timeout: data.timeout || 120,
    })
    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, reply, 'runtime')
    }
    saveConversation(ctx, data, content, reply)
  }
}

function saveConversation(ctx, data, content, reply) {
  ctx.db?.insert('conversations', {
    flow_id: ctx.variables.get('__flow_id'),
    node_id: data.id,
    role: 'user',
    content,
  })
  ctx.db?.insert('conversations', {
    flow_id: ctx.variables.get('__flow_id'),
    node_id: data.id,
    role: 'assistant',
    content: reply,
  })
}

/**
 * 条件评估
 */
function evaluateCondition(value, condition) {
  if (!condition) return false
  const { type, target } = condition
  switch (type) {
    case 'contains': return value.includes(target)
    case 'not-contains': return !value.includes(target)
    case 'equals': return value === target
    case 'regex': return new RegExp(target).test(value)
    case 'greater-than': return Number(value) > Number(target)
    case 'less-than': return Number(value) < Number(target)
    default: return false
  }
}
