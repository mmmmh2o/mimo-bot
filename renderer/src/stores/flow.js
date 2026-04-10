import { defineStore } from 'pinia'

export const useFlowStore = defineStore('flow', {
  state: () => ({
    currentFlow: null,
    nodes: [],
    edges: [],
    isRunning: false,
    isPaused: false,
    currentStep: null,
    totalSteps: 0,
    variables: {},
    logs: [],
  }),

  getters: {
    nodeById: (state) => (id) => {
      return state.nodes.find(n => n.id === id)
    },

    progress: (state) => {
      if (!state.totalSteps) return 0
      return Math.round((state.currentStep / state.totalSteps) * 100)
    },
  },

  actions: {
    async loadFlow(id) {
      const flow = await window.api.invoke('flow:get', id)
      this.currentFlow = flow
      this.nodes = flow.nodes || []
      this.edges = flow.edges || []
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
    },

    async saveFlow() {
      await window.api.invoke('flow:save', {
        ...this.currentFlow,
        nodes: this.nodes,
        edges: this.edges,
        variables: this.variables,
      })
    },

    async runFlow() {
      this.isRunning = true
      this.isPaused = false
      this.logs = []
      await window.api.invoke('flow:run', this.currentFlow.id)
    },

    async pauseFlow() {
      this.isPaused = true
      await window.api.invoke('flow:pause')
    },

    async resumeFlow() {
      this.isPaused = false
      await window.api.invoke('flow:resume')
    },

    async stopFlow() {
      this.isRunning = false
      this.isPaused = false
      await window.api.invoke('flow:stop')
    },

    // IPC 事件处理
    onNodeStarted(data) {
      this.currentStep = data.step
      this.totalSteps = data.total
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'info',
        message: `节点 ${data.nodeId} 开始执行`,
      })
    },

    onNodeCompleted(data) {
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'success',
        message: `节点 ${data.nodeId} 执行完成`,
      })
    },

    onVariableUpdated(data) {
      this.variables[data.name] = data.value
    },

    onFlowCompleted() {
      this.isRunning = false
      this.isPaused = false
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'success',
        message: '流程执行完成',
      })
    },

    onFlowError(data) {
      this.isRunning = false
      this.logs.push({
        time: new Date().toLocaleTimeString(),
        type: 'error',
        message: `错误: ${data.message}`,
      })
    },
  },
})
