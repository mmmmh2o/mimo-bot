import { defineStore } from 'pinia'

export const useFlowStore = defineStore('flow', {
  state: () => ({
    currentFlow: null,
    nodes: [],
    edges: [],
    flowList: [],
    isRunning: false,
    isPaused: false,
    currentStep: null,
    totalSteps: 0,
    currentNodeId: null,
    currentNodeType: null,
    variables: {},
    logs: [],
    error: null,
    startTime: null,
  }),

  getters: {
    nodeById: (state) => (id) => {
      return state.nodes.find(n => n.id === id)
    },

    progress: (state) => {
      if (!state.totalSteps) return 0
      return Math.round((state.currentStep / state.totalSteps) * 100)
    },

    elapsedSeconds: (state) => {
      if (!state.startTime) return 0
      return Math.round((Date.now() - state.startTime) / 1000)
    },
  },

  actions: {
    async loadFlowList() {
      try {
        this.flowList = await window.api.flow.list() || []
      } catch (e) {
        this.error = e.message
      }
    },

    async loadFlow(id) {
      try {
        const flow = await window.api.flow.get(id)
        this.currentFlow = flow
        this.nodes = flow?.nodes || []
        this.edges = flow?.edges || []
        this.variables = flow?.variables || {}
      } catch (e) {
        this.error = e.message
      }
    },

    createFlow() {
      this.currentFlow = {
        id: `flow-${Date.now()}`,
        name: '新流程',
        description: '',
        createdAt: new Date().toISOString(),
      }
      this.nodes = []
      this.edges = []
      this.variables = {}
    },

    async saveFlow() {
      if (!this.currentFlow) return
      try {
        // 深拷贝移除 Vue Proxy，否则 IPC structured clone 会报 "An object could not be cloned"
        const payload = JSON.parse(JSON.stringify({
          ...this.currentFlow,
          nodes: this.nodes,
          edges: this.edges,
          variables: this.variables,
        }))
        await window.api.flow.save(payload)
        await this.loadFlowList()
      } catch (e) {
        this.error = e.message
      }
    },

    async deleteFlow(id) {
      try {
        await window.api.flow.delete(id)
        if (this.currentFlow?.id === id) {
          this.currentFlow = null
          this.nodes = []
          this.edges = []
        }
        await this.loadFlowList()
      } catch (e) {
        this.error = e.message
      }
    },

    async runFlow() {
      if (!this.currentFlow) return
      // 先保存确保数据库有最新数据
      await this.saveFlow()
      this.isRunning = true
      this.isPaused = false
      this.error = null
      this.logs = []
      this.startTime = Date.now()
      try {
        await window.api.flow.run(this.currentFlow.id)
      } catch (e) {
        this.isRunning = false
        this.isPaused = false
        this.error = e.message
        this.logs.push({
          time: new Date().toLocaleTimeString(),
          type: 'error',
          message: `💥 启动失败: ${e.message}`,
        })
      }
    },

    async pauseFlow() {
      this.isPaused = true
      await window.api.flow.pause()
    },

    async resumeFlow() {
      this.isPaused = false
      await window.api.flow.resume()
    },

    async stopFlow() {
      this.isRunning = false
      this.isPaused = false
      await window.api.flow.stop()
    },

    // ---- IPC 事件处理 ----

    onFlowStarted(data) {
      this.isRunning = true
      this.startTime = Date.now()
      this.totalSteps = data.totalSteps
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'info',
        message: `🚀 流程 "${data.name}" 开始执行 (${data.totalSteps} 个节点)`,
      })
    },

    onNodeStarted(data) {
      this.currentStep = data.step
      this.totalSteps = data.total
      this.currentNodeId = data.nodeId
      this.currentNodeType = data.nodeType
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'info',
        message: `[${data.step}/${data.total}] 节点 ${data.nodeId} (${data.nodeType}) 执行中...`,
      })
    },

    onNodeCompleted(data) {
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'success',
        message: `[${data.step}/${data.total}] 节点 ${data.nodeId} ✅ 完成`,
      })
    },

    onNodeError(data) {
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'error',
        message: `❌ 节点 ${data.nodeId} 失败: ${data.error}`,
      })
    },

    onVariableUpdated(data) {
      this.variables[data.name] = data.value
    },

    onFlowCompleted() {
      this.isRunning = false
      this.isPaused = false
      const elapsed = this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'success',
        message: `🎉 流程执行完成! 耗时 ${elapsed}s`,
      })
    },

    onFlowPaused() {
      this.isPaused = true
    },

    onFlowResumed() {
      this.isPaused = false
    },

    onFlowError(data) {
      this.isRunning = false
      this.error = data.error
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'error',
        message: `💥 流程错误: ${data.error}`,
      })
    },

    onWaitingInput(data) {
      this.isPaused = true
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'warn',
        message: `🙋 等待人工操作: ${data.message}`,
      })
    },

    // 注册 IPC 事件监听
    subscribeEvents() {
      window.api.on('flow:started', (d) => this.onFlowStarted(d))
      window.api.on('flow:node-started', (d) => this.onNodeStarted(d))
      window.api.on('flow:node-completed', (d) => this.onNodeCompleted(d))
      window.api.on('flow:node-error', (d) => this.onNodeError(d))
      window.api.on('flow:variable-updated', (d) => this.onVariableUpdated(d))
      window.api.on('flow:completed', () => this.onFlowCompleted())
      window.api.on('flow:paused', () => this.onFlowPaused())
      window.api.on('flow:resumed', () => this.onFlowResumed())
      window.api.on('flow:error', (d) => this.onFlowError(d))
      window.api.on('flow:waiting-input', (d) => this.onWaitingInput(d))
    },
  },
})
