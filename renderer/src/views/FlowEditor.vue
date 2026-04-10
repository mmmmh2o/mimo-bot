<template>
  <div class="flow-editor">
    <div class="flow-header">
      <h1>🔀 流程编辑器</h1>
      <div class="flow-actions">
        <el-select v-model="currentFlowId" placeholder="选择流程" @change="loadFlow">
          <el-option
            v-for="flow in flowList"
            :key="flow.id"
            :label="flow.name"
            :value="flow.id"
          />
        </el-select>
        <el-button type="primary" @click="createFlow">➕ 新建</el-button>
        <el-button @click="saveFlow" :disabled="!currentFlow">💾 保存</el-button>
        <el-button type="success" @click="runFlow" :disabled="!currentFlow || isRunning">
          ▶ 运行
        </el-button>
      </div>
    </div>

    <div class="flow-workspace">
      <!-- 节点面板 -->
      <div class="node-palette">
        <h3>可用节点</h3>
        <div
          v-for="nodeType in availableNodes"
          :key="nodeType.type"
          class="palette-node"
          draggable="true"
          @dragstart="onDragStart($event, nodeType)"
        >
          <span class="node-icon">{{ nodeType.icon }}</span>
          <span class="node-label">{{ nodeType.label }}</span>
        </div>
      </div>

      <!-- 画布区域 -->
      <div class="flow-canvas" ref="canvasRef">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :default-viewport="{ zoom: 1 }"
          fit-view-on-init
          @node-click="onNodeClick"
          @connect="onConnect"
        >
          <Background pattern-color="#2a2a3e" />
          <Controls />
          <MiniMap />
        </VueFlow>
      </div>

      <!-- 节点配置面板 -->
      <div class="node-config" v-if="selectedNode">
        <h3>节点配置</h3>
        <el-form label-position="top">
          <el-form-item label="节点类型">
            <el-tag>{{ selectedNode.type }}</el-tag>
          </el-form-item>
          <el-form-item label="节点 ID">
            <el-input v-model="selectedNode.id" disabled />
          </el-form-item>
          <!-- 动态配置区域，根据节点类型渲染 -->
          <component
            :is="getNodeConfigComponent(selectedNode.type)"
            :node="selectedNode"
            @update="onNodeUpdate"
          />
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background, Controls, MiniMap } from '@vue-flow/core'
import { useFlowStore } from '@/stores/flow'

const flowStore = useFlowStore()

const currentFlowId = ref(null)
const currentFlow = computed(() => flowStore.currentFlow)
const nodes = computed({ get: () => flowStore.nodes, set: (v) => flowStore.nodes = v })
const edges = computed({ get: () => flowStore.edges, set: (v) => flowStore.edges = v })
const isRunning = computed(() => flowStore.isRunning)
const selectedNode = ref(null)
const flowList = ref([])

const availableNodes = [
  { type: 'start', icon: '🟢', label: '开始' },
  { type: 'send-message', icon: '💬', label: '发送消息' },
  { type: 'wait-reply', icon: '⏳', label: '等待回复' },
  { type: 'condition', icon: '🔀', label: '条件分支' },
  { type: 'loop', icon: '🔁', label: '循环' },
  { type: 'read-file', icon: '📁', label: '读取文件' },
  { type: 'scrape', icon: '🌐', label: '网页抓取' },
  { type: 'extract', icon: '📦', label: '提取变量' },
  { type: 'save', icon: '💾', label: '保存输出' },
  { type: 'set-variable', icon: '📝', label: '设置变量' },
  { type: 'human-handoff', icon: '🙋', label: '人工介入' },
  { type: 'delay', icon: '⏰', label: '延时等待' },
  { type: 'end', icon: '🏁', label: '结束' },
]

const loadFlow = async () => {
  if (currentFlowId.value) {
    await flowStore.loadFlow(currentFlowId.value)
  }
}

const createFlow = () => {
  flowStore.createFlow()
}

const saveFlow = async () => {
  await flowStore.saveFlow()
}

const runFlow = async () => {
  await flowStore.runFlow()
}

const onNodeClick = ({ node }) => {
  selectedNode.value = node
}

const onConnect = (params) => {
  edges.value.push({
    id: `e-${params.source}-${params.target}`,
    ...params,
  })
}

const onDragStart = (event, nodeType) => {
  event.dataTransfer.setData('application/nodeType', JSON.stringify(nodeType))
}

const onNodeUpdate = (data) => {
  if (selectedNode.value) {
    Object.assign(selectedNode.value.data, data)
  }
}

const getNodeConfigComponent = (type) => {
  // TODO: 返回对应节点类型的配置组件
  return 'div'
}
</script>

<style scoped>
.flow-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #2a2a3e;
}

.flow-header h1 {
  color: #fff;
  margin: 0;
}

.flow-actions {
  display: flex;
  gap: 8px;
}

.flow-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.node-palette {
  width: 180px;
  padding: 16px;
  border-right: 1px solid #2a2a3e;
  overflow-y: auto;
}

.node-palette h3 {
  color: #aaa;
  font-size: 13px;
  margin-bottom: 12px;
}

.palette-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
  cursor: grab;
  transition: all 0.2s;
}

.palette-node:hover {
  border-color: #4fc3f7;
  background: #252540;
}

.node-icon {
  font-size: 16px;
}

.node-label {
  font-size: 13px;
  color: #ccc;
}

.flow-canvas {
  flex: 1;
  background: #0f0f1a;
}

.node-config {
  width: 300px;
  padding: 16px;
  border-left: 1px solid #2a2a3e;
  overflow-y: auto;
}

.node-config h3 {
  color: #aaa;
  font-size: 13px;
  margin-bottom: 12px;
}
</style>
