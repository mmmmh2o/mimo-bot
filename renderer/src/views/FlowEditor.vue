<template>
  <div class="flow-editor">
    <div class="flow-header">
      <h1>🔀 流程编辑器</h1>
      <div class="flow-actions">
        <el-select v-model="currentFlowId" placeholder="选择流程" @change="loadFlow" style="width:200px">
          <el-option
            v-for="flow in flowStore.flowList"
            :key="flow.id"
            :label="flow.name"
            :value="flow.id"
          />
        </el-select>
        <el-button type="primary" @click="createFlow">➕ 新建</el-button>
        <el-button @click="saveFlow" :disabled="!currentFlow">💾 保存</el-button>
        <el-button type="success" @click="runFlow" :disabled="!currentFlow || flowStore.isRunning">
          ▶ 运行
        </el-button>
        <el-button type="warning" @click="pauseFlow" v-if="flowStore.isRunning && !flowStore.isPaused">⏸ 暂停</el-button>
        <el-button type="primary" @click="resumeFlow" v-if="flowStore.isPaused">▶ 恢复</el-button>
        <el-button type="danger" @click="stopFlow" v-if="flowStore.isRunning">🛑 停止</el-button>
        <el-button type="danger" plain @click="deleteCurrentFlow" :disabled="!currentFlow">🗑️ 删除</el-button>
      </div>
    </div>

    <!-- 运行进度条 -->
    <div class="flow-progress" v-if="flowStore.isRunning">
      <el-progress
        :percentage="flowStore.progress"
        :status="flowStore.isPaused ? 'warning' : undefined"
        :stroke-width="6"
        :format="() => `${flowStore.currentStep || 0}/${flowStore.totalSteps}`"
      />
      <span class="progress-label">
        {{ flowStore.currentNodeId ? `当前: ${flowStore.currentNodeId} (${flowStore.currentNodeType || '?'})` : '准备中...' }}
      </span>
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
      <div class="flow-canvas">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :default-viewport="{ zoom: 1 }"
          fit-view-on-init
          @node-click="onNodeClick"
          @connect="onConnect"
          @dragover.prevent
          @drop="onDrop"
        >
          <Background pattern-color="#2a2a3e" />
          <Controls />
          <MiniMap />
        </VueFlow>
      </div>

      <!-- 节点配置面板 -->
      <div class="node-config" v-if="selectedNode">
        <div class="config-header">
          <h3>节点配置</h3>
          <el-button size="small" type="danger" plain @click="deleteNode">🗑️</el-button>
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="节点类型">
            <el-tag>{{ nodeTypeLabel(selectedNode.type) }}</el-tag>
          </el-form-item>
          <el-form-item label="节点 ID">
            <el-input v-model="selectedNode.id" disabled />
          </el-form-item>

          <!-- send-message 配置 -->
          <template v-if="selectedNode.type === 'send-message'">
            <el-form-item label="消息内容">
              <el-input v-model="selectedNode.data.content" type="textarea" :rows="4" placeholder="支持 {{变量}}" />
            </el-form-item>
            <el-form-item label="等待回复">
              <el-switch v-model="selectedNode.data.waitForReply" />
            </el-form-item>
            <el-form-item label="回复超时 (秒)" v-if="selectedNode.data.waitForReply">
              <el-input-number v-model="selectedNode.data.timeout" :min="10" :max="600" />
            </el-form-item>
            <el-form-item label="输出变量名" v-if="selectedNode.data.waitForReply">
              <el-input v-model="selectedNode.data.outputVariable" placeholder="reply" />
            </el-form-item>
          </template>

          <!-- wait-reply 配置 -->
          <template v-if="selectedNode.type === 'wait-reply'">
            <el-form-item label="超时 (秒)">
              <el-input-number v-model="selectedNode.data.timeout" :min="10" :max="600" />
            </el-form-item>
            <el-form-item label="输出变量名">
              <el-input v-model="selectedNode.data.outputVariable" placeholder="reply" />
            </el-form-item>
          </template>

          <!-- condition 配置 -->
          <template v-if="selectedNode.type === 'condition'">
            <el-form-item label="源变量">
              <el-input v-model="selectedNode.data.sourceVariable" placeholder="变量名" />
            </el-form-item>
            <el-form-item label="条件类型">
              <el-select v-model="selectedNode.data.condition.type">
                <el-option label="包含" value="contains" />
                <el-option label="不包含" value="not-contains" />
                <el-option label="等于" value="equals" />
                <el-option label="正则匹配" value="regex" />
                <el-option label="大于" value="greater-than" />
                <el-option label="小于" value="less-than" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标值">
              <el-input v-model="selectedNode.data.condition.target" />
            </el-form-item>
          </template>

          <!-- loop 配置 -->
          <template v-if="selectedNode.type === 'loop'">
            <el-form-item label="数据源变量">
              <el-input v-model="selectedNode.data.sourceVariable" />
            </el-form-item>
            <el-form-item label="最大迭代次数">
              <el-input-number v-model="selectedNode.data.maxIterations" :min="1" :max="1000" />
            </el-form-item>
            <el-form-item label="当前项变量名">
              <el-input v-model="selectedNode.data.itemVariable" placeholder="item" />
            </el-form-item>
          </template>

          <!-- extract 配置 -->
          <template v-if="selectedNode.type === 'extract'">
            <el-form-item label="源变量">
              <el-input v-model="selectedNode.data.sourceVariable" />
            </el-form-item>
            <el-form-item label="提取规则">
              <div v-for="(rule, i) in (selectedNode.data.rules || [])" :key="i" class="rule-item">
                <el-select v-model="rule.type" style="width:80px">
                  <el-option label="正则" value="regex" />
                  <el-option label="代码块" value="code-block" />
                </el-select>
                <el-input v-model="rule.pattern" placeholder="正则或语言" style="flex:1" />
                <el-input v-model="rule.variable" placeholder="变量名" style="width:100px" />
                <el-button size="small" type="danger" plain @click="selectedNode.data.rules.splice(i, 1)">×</el-button>
              </div>
              <el-button size="small" @click="addExtractRule">+ 添加规则</el-button>
            </el-form-item>
          </template>

          <!-- read-file 配置 -->
          <template v-if="selectedNode.type === 'read-file'">
            <el-form-item label="文件路径">
              <el-input v-model="selectedNode.data.path" placeholder="支持 {{变量}}" />
            </el-form-item>
            <el-form-item label="输出变量名">
              <el-input v-model="selectedNode.data.outputVariable" />
            </el-form-item>
          </template>

          <!-- save 配置 -->
          <template v-if="selectedNode.type === 'save'">
            <el-form-item label="变量名">
              <el-input v-model="selectedNode.data.variable" />
            </el-form-item>
            <el-form-item label="保存路径">
              <el-input v-model="selectedNode.data.path" />
            </el-form-item>
            <el-form-item label="追加模式">
              <el-switch v-model="selectedNode.data.append" />
            </el-form-item>
          </template>

          <!-- set-variable 配置 -->
          <template v-if="selectedNode.type === 'set-variable'">
            <el-form-item label="变量名">
              <el-input v-model="selectedNode.data.name" />
            </el-form-item>
            <el-form-item label="值">
              <el-input v-model="selectedNode.data.value" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="作用域">
              <el-select v-model="selectedNode.data.scope">
                <el-option label="输入" value="input" />
                <el-option label="运行时" value="runtime" />
                <el-option label="输出" value="output" />
                <el-option label="持久化" value="persistent" />
              </el-select>
            </el-form-item>
          </template>

          <!-- delay 配置 -->
          <template v-if="selectedNode.type === 'delay'">
            <el-form-item label="延时 (秒)">
              <el-input-number v-model="selectedNode.data.seconds" :min="1" :max="3600" />
            </el-form-item>
          </template>

          <!-- scrape 配置 -->
          <template v-if="selectedNode.type === 'scrape'">
            <el-form-item label="URL">
              <el-input v-model="selectedNode.data.url" placeholder="支持 {{变量}}" />
            </el-form-item>
            <el-form-item label="选择器">
              <el-input v-model="selectedNode.data.selector" placeholder="CSS 选择器" />
            </el-form-item>
            <el-form-item label="输出变量名">
              <el-input v-model="selectedNode.data.outputVariable" />
            </el-form-item>
          </template>

          <!-- run-command 配置 -->
          <template v-if="selectedNode.type === 'run-command'">
            <el-form-item label="命令">
              <el-input v-model="selectedNode.data.command" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="工作目录">
              <el-input v-model="selectedNode.data.workingDir" />
            </el-form-item>
            <el-form-item label="超时 (秒)">
              <el-input-number v-model="selectedNode.data.timeout" :min="5" :max="3600" />
            </el-form-item>
            <el-form-item label="输出变量名">
              <el-input v-model="selectedNode.data.outputVariable" />
            </el-form-item>
          </template>

          <!-- human-handoff 配置 -->
          <template v-if="selectedNode.type === 'human-handoff'">
            <el-form-item label="提示消息">
              <el-input v-model="selectedNode.data.message" type="textarea" :rows="2" />
            </el-form-item>
          </template>

          <!-- 通用：出错继续 -->
          <el-form-item label="出错时继续">
            <el-switch v-model="selectedNode.data.continueOnError" />
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 运行日志抽屉 -->
    <el-drawer v-model="showLogs" title="运行日志" size="400px" direction="rtl">
      <div class="run-logs">
        <div
          v-for="(log, i) in flowStore.logs"
          :key="i"
          class="log-line"
          :class="'log-' + log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
        <div v-if="flowStore.logs.length === 0" class="log-empty">暂无日志</div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background, Controls, MiniMap } from '@vue-flow/core'
import { useFlowStore } from '@/stores/flow'
import { ElMessage, ElMessageBox } from 'element-plus'

const flowStore = useFlowStore()

const currentFlowId = ref(null)
const currentFlow = computed(() => flowStore.currentFlow)
const nodes = computed({ get: () => flowStore.nodes, set: (v) => flowStore.nodes = v })
const edges = computed({ get: () => flowStore.edges, set: (v) => flowStore.edges = v })
const selectedNode = ref(null)
const showLogs = ref(false)

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
  { type: 'run-command', icon: '⚡', label: '运行命令' },
  { type: 'human-handoff', icon: '🙋', label: '人工介入' },
  { type: 'delay', icon: '⏰', label: '延时等待' },
  { type: 'end', icon: '🏁', label: '结束' },
]

const nodeTypeLabel = (type) => {
  const node = availableNodes.find(n => n.type === type)
  return node ? `${node.icon} ${node.label}` : type
}

const defaultNodeData = (type) => {
  const defaults = {
    'send-message': { content: '', waitForReply: true, timeout: 120, typingSpeed: [50, 150], delayBeforeSend: [1000, 3000] },
    'wait-reply': { timeout: 120 },
    'condition': { sourceVariable: '', condition: { type: 'contains', target: '' } },
    'loop': { sourceVariable: '', maxIterations: 100, itemVariable: 'item' },
    'extract': { sourceVariable: '', rules: [{ type: 'regex', pattern: '', variable: '' }] },
    'read-file': { path: '', outputVariable: '' },
    'save': { variable: '', path: '', append: false },
    'set-variable': { name: '', value: '', scope: 'runtime' },
    'delay': { seconds: 5 },
    'scrape': { url: '', selector: '', outputVariable: '' },
    'run-command': { command: '', workingDir: '', timeout: 60, outputVariable: '' },
    'human-handoff': { message: '需要人工介入' },
    'start': {},
    'end': {},
  }
  return { ...defaults[type], continueOnError: false }
}

const loadFlow = async () => {
  if (currentFlowId.value) {
    await flowStore.loadFlow(currentFlowId.value)
    selectedNode.value = null
  }
}

const createFlow = () => {
  flowStore.createFlow()
  currentFlowId.value = flowStore.currentFlow.id
  ElMessage.success('新流程已创建')
}

const saveFlow = async () => {
  await flowStore.saveFlow()
  if (!flowStore.error) {
    ElMessage.success('流程已保存')
  } else {
    ElMessage.error(`保存失败: ${flowStore.error}`)
  }
}

const runFlow = async () => {
  await saveFlow()
  await flowStore.runFlow()
  showLogs.value = true
}

const pauseFlow = () => flowStore.pauseFlow()
const resumeFlow = () => flowStore.resumeFlow()
const stopFlow = () => flowStore.stopFlow()

const deleteCurrentFlow = async () => {
  if (!currentFlow.value) return
  await ElMessageBox.confirm(`确定删除流程 "${currentFlow.value.name}"？`, '确认删除', { type: 'warning' })
  await flowStore.deleteFlow(currentFlow.value.id)
  currentFlowId.value = null
  selectedNode.value = null
  ElMessage.success('已删除')
}

const deleteNode = () => {
  if (!selectedNode.value) return
  const id = selectedNode.value.id
  nodes.value = nodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
  selectedNode.value = null
}

const addExtractRule = () => {
  if (!selectedNode.value.data.rules) {
    selectedNode.value.data.rules = []
  }
  selectedNode.value.data.rules.push({ type: 'regex', pattern: '', variable: '' })
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

const onDrop = (event) => {
  const data = event.dataTransfer.getData('application/nodeType')
  if (!data) return
  const nodeType = JSON.parse(data)
  const rect = event.currentTarget.getBoundingClientRect()
  const position = {
    x: event.clientX - rect.left - 80,
    y: event.clientY - rect.top - 30,
  }
  const newNode = {
    id: `${nodeType.type}-${Date.now()}`,
    type: nodeType.type,
    position,
    data: defaultNodeData(nodeType.type),
    label: nodeType.label,
  }
  nodes.value.push(newNode)
}

// 运行时自动显示日志
watch(() => flowStore.isRunning, (val) => {
  if (val) showLogs.value = true
})

onMounted(async () => {
  await flowStore.loadFlowList()
  flowStore.subscribeEvents()
})
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
  flex-wrap: wrap;
  gap: 8px;
}

.flow-header h1 {
  color: #fff;
  margin: 0;
}

.flow-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.flow-progress {
  padding: 8px 24px;
  border-bottom: 1px solid #2a2a3e;
  display: flex;
  align-items: center;
  gap: 12px;
}

.flow-progress .el-progress {
  flex: 1;
}

.progress-label {
  font-size: 12px;
  color: #aaa;
  white-space: nowrap;
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
  width: 320px;
  padding: 16px;
  border-left: 1px solid #2a2a3e;
  overflow-y: auto;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-header h3 {
  color: #aaa;
  font-size: 13px;
  margin: 0;
}

.rule-item {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
  align-items: center;
}

.run-logs {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.log-line {
  padding: 4px 0;
  border-bottom: 1px solid #1e1e2e;
}

.log-time {
  color: #666;
  margin-right: 8px;
}

.log-msg {
  color: #ccc;
}

.log-info .log-msg { color: #4fc3f7; }
.log-success .log-msg { color: #4caf50; }
.log-warn .log-msg { color: #ff9800; }
.log-error .log-msg { color: #f44336; }

.log-empty {
  color: #555;
  text-align: center;
  padding: 40px;
}
</style>
