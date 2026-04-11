<template>
  <div class="flow-editor">
    <!-- 顶部工具栏 -->
    <div class="flow-header">
      <div class="header-left">
        <h1>🔀 流程编辑器</h1>
        <div class="flow-selector">
          <el-select v-model="currentFlowId" placeholder="选择流程" @change="loadFlow" style="width:200px" size="default">
            <el-option
              v-for="flow in flowStore.flowList"
              :key="flow.id"
              :label="flow.name"
              :value="flow.id"
            />
          </el-select>
          <el-button type="primary" @click="createFlow">➕ 新建</el-button>
          <el-dropdown @command="loadTemplate" trigger="click">
            <el-button type="info" plain>📋 示例</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="hello-world">👋 Hello World</el-dropdown-item>
                <el-dropdown-item command="web-scraper">🌐 网页抓取</el-dropdown-item>
                <el-dropdown-item command="auto-reply">💬 自动回复</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="header-actions">
        <el-tooltip :content="!currentFlow ? '请先新建或选择一个流程' : ''" placement="bottom" :disabled="!!currentFlow">
          <el-button @click="saveFlow" :disabled="!currentFlow">💾 保存</el-button>
        </el-tooltip>
        <el-button type="success" @click="runFlow" :disabled="!currentFlow || nodes.length === 0 || flowStore.isRunning">
          ▶ 运行
        </el-button>
        <el-button type="warning" @click="pauseFlow" v-if="flowStore.isRunning && !flowStore.isPaused">⏸ 暂停</el-button>
        <el-button type="primary" @click="resumeFlow" v-if="flowStore.isPaused">▶ 恢复</el-button>
        <el-button type="danger" @click="stopFlow" v-if="flowStore.isRunning">⏹ 停止</el-button>
        <el-button type="danger" plain @click="deleteCurrentFlow" :disabled="!currentFlow">🗑️ 删除</el-button>
      </div>
    </div>

    <!-- 运行进度条 -->
    <div class="flow-progress" v-if="flowStore.isRunning">
      <div class="progress-inner">
        <el-progress
          :percentage="flowStore.progress"
          :status="flowStore.isPaused ? 'warning' : undefined"
          :stroke-width="6"
          :format="() => `${flowStore.currentStep || 0}/${flowStore.totalSteps}`"
        />
        <span class="progress-label">
          {{ flowStore.currentNodeId ? `正在执行: ${flowStore.currentNodeType || '?'}` : '准备中...' }}
        </span>
      </div>
    </div>

    <div class="flow-workspace">
      <!-- 节点面板（分组） -->
      <div class="node-palette">
        <div class="palette-header">
          <h3>📦 节点面板</h3>
        </div>

        <div v-for="group in nodeGroups" :key="group.name" class="node-group">
          <div class="group-title" @click="group.collapsed = !group.collapsed">
            <span>{{ group.icon }} {{ group.name }}</span>
            <span class="collapse-arrow" :class="{ collapsed: group.collapsed }">▼</span>
          </div>
          <div v-show="!group.collapsed" class="group-nodes">
            <div
              v-for="nodeType in group.nodes"
              :key="nodeType.type"
              class="palette-node"
              draggable="true"
              @dragstart="onDragStart($event, nodeType)"
            >
              <span class="node-icon">{{ nodeType.icon }}</span>
              <div class="node-info">
                <span class="node-label">{{ nodeType.label }}</span>
                <span class="node-desc">{{ nodeType.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 画布区域 -->
      <div class="flow-canvas" ref="canvasRef">
        <!-- 空状态引导 -->
        <div v-if="!currentFlow" class="empty-state">
          <div class="empty-content">
            <div class="empty-icon">🎯</div>
            <h2>开始构建你的自动化流程</h2>
            <p class="empty-subtitle">可视化拖拽，零代码完成网页自动化任务</p>

            <div class="guide-steps">
              <div class="guide-step">
                <div class="step-number">1</div>
                <div class="step-info">
                  <strong>新建流程</strong>
                  <span>点击上方「新建」或选择下方示例</span>
                </div>
              </div>
              <div class="guide-step">
                <div class="step-number">2</div>
                <div class="step-info">
                  <strong>拖入节点</strong>
                  <span>从左侧面板拖拽节点到画布</span>
                </div>
              </div>
              <div class="guide-step">
                <div class="step-number">3</div>
                <div class="step-info">
                  <strong>连接节点</strong>
                  <span>拖动节点之间的圆点建立连接</span>
                </div>
              </div>
              <div class="guide-step">
                <div class="step-number">4</div>
                <div class="step-info">
                  <strong>运行流程</strong>
                  <span>配置完成后点击「运行」执行</span>
                </div>
              </div>
            </div>

            <div class="quick-actions">
              <el-button type="primary" size="large" @click="createFlow">
                🚀 空白流程
              </el-button>
              <el-button size="large" @click="loadTemplate('hello-world')">
                👋 Hello World 示例
              </el-button>
            </div>
          </div>
        </div>

        <!-- 有流程但画布空 -->
        <div v-else-if="currentFlow && nodes.length === 0" class="canvas-hint">
          <div class="hint-content">
            <span class="hint-arrow">⬅️</span>
            <span>从左侧拖拽节点到这里 · 或点击「📋 示例」加载模板</span>
          </div>
        </div>

        <VueFlow
          v-if="currentFlow"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :default-viewport="{ zoom: 1, x: 0, y: 0 }"
          :snap-to-grid="true"
          :snap-grid="[20, 20]"
          @node-click="onNodeClick"
          @connect="onConnect"
          @dragover.prevent
          @drop="onDrop"
          @pane-click="selectedNode = null"
        >
          <Background :gap="20" :size="1" />
          <Controls position="bottom-left" />
        </VueFlow>
      </div>

      <!-- 节点配置面板 -->
      <div class="node-config" v-if="selectedNode">
        <div class="config-header">
          <h3>⚙️ 节点配置</h3>
          <el-button size="small" type="danger" plain @click="deleteNode">🗑️ 删除</el-button>
        </div>
        <div class="config-type-badge">
          <span class="type-icon">{{ getNodeIcon(selectedNode.type) }}</span>
          <span>{{ getNodeLabel(selectedNode.type) }}</span>
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="节点 ID">
            <el-input :model-value="selectedNode.id" disabled />
          </el-form-item>

          <!-- send-message 配置 -->
          <template v-if="selectedNode.type === 'send-message'">
            <el-form-item label="消息内容">
              <el-input v-model="selectedNode.data.content" type="textarea" :rows="4" placeholder="支持 {{变量}} 插值" />
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
    <el-drawer v-model="showLogs" title="📋 运行日志" size="400px" direction="rtl">
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
        <div v-if="flowStore.logs.length === 0" class="log-empty">暂无日志，运行流程后将在此显示</div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useFlowStore } from '@/stores/flow'
import { ElMessage, ElMessageBox } from 'element-plus'

const flowStore = useFlowStore()

const currentFlowId = ref(null)
const currentFlow = computed(() => flowStore.currentFlow)
const nodes = computed({ get: () => flowStore.nodes, set: (v) => flowStore.nodes = v })
const edges = computed({ get: () => flowStore.edges, set: (v) => flowStore.edges = v })
const selectedNode = ref(null)
const showLogs = ref(false)

// 分组节点
const nodeGroups = reactive([
  {
    name: '流程控制',
    icon: '🔧',
    collapsed: false,
    nodes: [
      { type: 'start', icon: '🟢', label: '开始', desc: '流程入口' },
      { type: 'end', icon: '🏁', label: '结束', desc: '流程出口' },
      { type: 'condition', icon: '🔀', label: '条件分支', desc: '根据条件走不同路径' },
      { type: 'loop', icon: '🔁', label: '循环', desc: '遍历列表或重复执行' },
      { type: 'delay', icon: '⏰', label: '延时等待', desc: '暂停指定秒数' },
    ]
  },
  {
    name: '消息交互',
    icon: '💬',
    collapsed: false,
    nodes: [
      { type: 'send-message', icon: '📤', label: '发送消息', desc: '向页面发送消息' },
      { type: 'wait-reply', icon: '⏳', label: '等待回复', desc: '等待用户输入' },
      { type: 'human-handoff', icon: '🙋', label: '人工介入', desc: '暂停等人处理' },
    ]
  },
  {
    name: '数据处理',
    icon: '📊',
    collapsed: false,
    nodes: [
      { type: 'set-variable', icon: '📝', label: '设置变量', desc: '定义或修改变量' },
      { type: 'extract', icon: '📦', label: '提取变量', desc: '从文本中提取数据' },
      { type: 'read-file', icon: '📁', label: '读取文件', desc: '读取本地文件内容' },
      { type: 'save', icon: '💾', label: '保存输出', desc: '将结果写入文件' },
    ]
  },
  {
    name: '系统操作',
    icon: '⚡',
    collapsed: false,
    nodes: [
      { type: 'scrape', icon: '🌐', label: '网页抓取', desc: '抓取网页内容' },
      { type: 'run-command', icon: '🖥️', label: '运行命令', desc: '执行系统命令' },
    ]
  },
])

// ===== 示例模板 =====
const templates = {
  'hello-world': {
    name: 'Hello World 示例',
    description: '最简单的流程：发送消息 → 等待回复 → 输出结果',
    nodes: [
      {
        id: 'start-1', type: 'start', position: { x: 100, y: 200 },
        data: { continueOnError: false }, label: '🟢 开始'
      },
      {
        id: 'send-1', type: 'send-message', position: { x: 350, y: 200 },
        data: {
          content: '👋 你好！我是 MiMo Bot，有什么可以帮你的？',
          waitForReply: true, timeout: 120, outputVariable: 'userReply',
          continueOnError: false
        }, label: '📤 发送消息'
      },
      {
        id: 'set-1', type: 'set-variable', position: { x: 600, y: 200 },
        data: {
          name: 'greeting',
          value: '收到回复: {{userReply}}',
          scope: 'output',
          continueOnError: false
        }, label: '📝 设置变量'
      },
      {
        id: 'end-1', type: 'end', position: { x: 850, y: 200 },
        data: { continueOnError: false }, label: '🏁 结束'
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'send-1' },
      { id: 'e2', source: 'send-1', target: 'set-1' },
      { id: 'e3', source: 'set-1', target: 'end-1' },
    ]
  },

  'web-scraper': {
    name: '网页抓取示例',
    description: '打开网页 → 抓取内容 → 提取数据 → 保存结果',
    nodes: [
      {
        id: 'start-1', type: 'start', position: { x: 100, y: 200 },
        data: { continueOnError: false }, label: '🟢 开始'
      },
      {
        id: 'set-url', type: 'set-variable', position: { x: 300, y: 200 },
        data: {
          name: 'targetUrl',
          value: 'https://news.ycombinator.com',
          scope: 'runtime',
          continueOnError: false
        }, label: '📝 设置 URL'
      },
      {
        id: 'scrape-1', type: 'scrape', position: { x: 550, y: 200 },
        data: {
          url: '{{targetUrl}}',
          selector: '.titleline > a',
          outputVariable: 'titles',
          continueOnError: false
        }, label: '🌐 抓取标题'
      },
      {
        id: 'save-1', type: 'save', position: { x: 800, y: 200 },
        data: {
          variable: 'titles',
          path: './output/titles.txt',
          append: false,
          continueOnError: false
        }, label: '💾 保存结果'
      },
      {
        id: 'end-1', type: 'end', position: { x: 1050, y: 200 },
        data: { continueOnError: false }, label: '🏁 结束'
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'set-url' },
      { id: 'e2', source: 'set-url', target: 'scrape-1' },
      { id: 'e3', source: 'scrape-1', target: 'save-1' },
      { id: 'e4', source: 'save-1', target: 'end-1' },
    ]
  },

  'auto-reply': {
    name: '自动回复示例',
    description: '等待输入 → 条件判断 → 不同回复 → 循环',
    nodes: [
      {
        id: 'start-1', type: 'start', position: { x: 100, y: 250 },
        data: { continueOnError: false }, label: '🟢 开始'
      },
      {
        id: 'send-1', type: 'send-message', position: { x: 320, y: 250 },
        data: {
          content: '输入 "帮助" 查看指令列表',
          waitForReply: true, timeout: 300, outputVariable: 'input',
          continueOnError: false
        }, label: '📤 提示输入'
      },
      {
        id: 'cond-1', type: 'condition', position: { x: 580, y: 250 },
        data: {
          sourceVariable: 'input',
          condition: { type: 'contains', target: '帮助' },
          continueOnError: false
        }, label: '🔀 判断内容'
      },
      {
        id: 'send-help', type: 'send-message', position: { x: 820, y: 130 },
        data: {
          content: '📖 指令列表：\n- 帮助：显示此消息\n- 状态：查看运行状态\n- 退出：结束对话',
          waitForReply: false,
          continueOnError: false
        }, label: '📤 发送帮助'
      },
      {
        id: 'send-default', type: 'send-message', position: { x: 820, y: 370 },
        data: {
          content: '收到：{{input}}。输入 "帮助" 查看指令。',
          waitForReply: false,
          continueOnError: false
        }, label: '📤 默认回复'
      },
      {
        id: 'end-1', type: 'end', position: { x: 1080, y: 250 },
        data: { continueOnError: false }, label: '🏁 结束'
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'send-1' },
      { id: 'e2', source: 'send-1', target: 'cond-1' },
      { id: 'e3', source: 'cond-1', target: 'send-help', label: '包含' },
      { id: 'e4', source: 'cond-1', target: 'send-default', label: '其他' },
      { id: 'e5', source: 'send-help', target: 'end-1' },
      { id: 'e6', source: 'send-default', target: 'end-1' },
    ]
  },
}

// ===== 工具函数 =====

const getNodeIcon = (type) => {
  for (const g of nodeGroups) {
    const n = g.nodes.find(n => n.type === type)
    if (n) return n.icon
  }
  return '❓'
}

const getNodeLabel = (type) => {
  for (const g of nodeGroups) {
    const n = g.nodes.find(n => n.type === type)
    if (n) return n.label
  }
  return type
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

// ===== 操作 =====

const loadFlow = async () => {
  if (currentFlowId.value) {
    await flowStore.loadFlow(currentFlowId.value)
    selectedNode.value = null
  }
}

const createFlow = () => {
  flowStore.createFlow()
  currentFlowId.value = flowStore.currentFlow.id
  ElMessage.success('新流程已创建，从左侧拖拽节点开始构建')
}

const loadTemplate = async (templateId) => {
  const tpl = templates[templateId]
  if (!tpl) return

  flowStore.currentFlow = {
    id: `flow-${Date.now()}`,
    name: tpl.name,
    description: tpl.description,
    createdAt: new Date().toISOString(),
  }
  // 深拷贝避免引用问题
  flowStore.nodes = JSON.parse(JSON.stringify(tpl.nodes))
  flowStore.edges = JSON.parse(JSON.stringify(tpl.edges))
  flowStore.variables = {}
  currentFlowId.value = flowStore.currentFlow.id
  selectedNode.value = null
  ElMessage.success(`已加载示例「${tpl.name}」，点击节点查看配置`)
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
  edges.value = [...edges.value, {
    id: `e-${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
  }]
}

const onDragStart = (event, nodeType) => {
  event.dataTransfer.setData('application/nodeType', JSON.stringify(nodeType))
  event.dataTransfer.effectAllowed = 'move'
}

const onDrop = (event) => {
  const data = event.dataTransfer.getData('application/nodeType')
  if (!data || !currentFlow.value) return
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
    label: `${nodeType.icon} ${nodeType.label}`,
  }
  nodes.value = [...nodes.value, newNode]
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
  background: #0d1117;
}

/* ====== 顶部工具栏 ====== */
.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  flex-wrap: wrap;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h1 {
  color: #e6edf3;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.flow-selector {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ====== 运行进度 ====== */
.flow-progress {
  background: #1c2333;
  border-bottom: 1px solid #21262d;
  padding: 8px 20px;
}

.progress-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-inner .el-progress {
  flex: 1;
}

.progress-label {
  font-size: 12px;
  color: #8b949e;
  white-space: nowrap;
}

/* ====== 工作区 ====== */
.flow-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ====== 节点面板 ====== */
.node-palette {
  width: 220px;
  background: #161b22;
  border-right: 1px solid #21262d;
  overflow-y: auto;
  flex-shrink: 0;
}

.palette-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #21262d;
}

.palette-header h3 {
  color: #e6edf3;
  font-size: 14px;
  margin: 0;
}

/* 分组 */
.node-group {
  border-bottom: 1px solid #21262d;
}

.group-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  color: #8b949e;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.group-title:hover {
  color: #e6edf3;
}

.collapse-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.collapse-arrow.collapsed {
  transform: rotate(-90deg);
}

.group-nodes {
  padding: 4px 10px 10px;
}

/* 节点卡片 */
.palette-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  background: #0d1117;
  border: 1px solid #21262d;
  cursor: grab;
  transition: all 0.15s ease;
}

.palette-node:hover {
  border-color: #58a6ff;
  background: #1c2333;
  transform: translateX(2px);
}

.palette-node:active {
  cursor: grabbing;
  transform: scale(0.97);
}

.node-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.node-label {
  font-size: 13px;
  color: #e6edf3;
  font-weight: 500;
  line-height: 1.2;
}

.node-desc {
  font-size: 10px;
  color: #484f58;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ====== 画布 ====== */
.flow-canvas {
  flex: 1;
  background: #0d1117;
  position: relative;
  overflow: hidden;
}

/* 空状态引导 */
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  background: rgba(13, 17, 23, 0.97);
}

.empty-content {
  text-align: center;
  max-width: 500px;
  padding: 40px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-content h2 {
  color: #e6edf3;
  font-size: 22px;
  margin-bottom: 8px;
  font-weight: 600;
}

.empty-subtitle {
  color: #8b949e;
  font-size: 14px;
  margin-bottom: 32px;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
  text-align: left;
}

.guide-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 10px;
  transition: all 0.2s;
}

.guide-step:hover {
  border-color: #30363d;
  background: #1c2333;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #238636, #2ea043);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-info strong {
  color: #e6edf3;
  font-size: 14px;
}

.step-info span {
  color: #8b949e;
  font-size: 12px;
}

.quick-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* 有流程但画布空 */
.canvas-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  pointer-events: none;
}

.hint-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: rgba(22, 27, 34, 0.95);
  border: 1px dashed #30363d;
  border-radius: 10px;
  color: #8b949e;
  font-size: 14px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.hint-arrow {
  font-size: 18px;
}

/* ====== 配置面板 ====== */
.node-config {
  width: 300px;
  background: #161b22;
  border-left: 1px solid #21262d;
  overflow-y: auto;
  padding: 16px;
  flex-shrink: 0;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-header h3 {
  color: #e6edf3;
  font-size: 14px;
  margin: 0;
}

.config-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #1c2333;
  border: 1px solid #30363d;
  border-radius: 20px;
  color: #8b949e;
  font-size: 13px;
  margin-bottom: 16px;
}

.type-icon {
  font-size: 16px;
}

.rule-item {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
  align-items: center;
}

/* ====== 日志 ====== */
.run-logs {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
}

.log-line {
  padding: 4px 0;
  border-bottom: 1px solid #21262d;
}

.log-time {
  color: #484f58;
  margin-right: 8px;
}

.log-msg {
  color: #8b949e;
}

.log-info .log-msg { color: #58a6ff; }
.log-success .log-msg { color: #3fb950; }
.log-warn .log-msg { color: #d29922; }
.log-error .log-msg { color: #f85149; }

.log-empty {
  color: #484f58;
  text-align: center;
  padding: 40px;
}

/* ====== VueFlow 节点暗色主题 ====== */
:deep(.vue-flow__node) {
  background: #161b22;
  border: 2px solid #30363d;
  border-radius: 10px;
  color: #e6edf3;
  font-size: 13px;
  font-weight: 500;
  padding: 12px 18px;
  min-width: 140px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.15s ease;
}

:deep(.vue-flow__node:hover) {
  border-color: #58a6ff;
  box-shadow: 0 4px 16px rgba(88, 166, 255, 0.15);
}

:deep(.vue-flow__node.selected) {
  border-color: #58a6ff;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3), 0 4px 16px rgba(88, 166, 255, 0.2);
}

/* 节点类型颜色 */
:deep(.vue-flow__node-start) {
  border-color: #238636;
  background: linear-gradient(135deg, #0d1117, #0f2a15);
}

:deep(.vue-flow__node-end) {
  border-color: #da3633;
  background: linear-gradient(135deg, #0d1117, #2d1214);
}

:deep(.vue-flow__node-send-message) {
  border-color: #1f6feb;
}

:deep(.vue-flow__node-condition) {
  border-color: #d29922;
}

:deep(.vue-flow__node-scrape) {
  border-color: #8b5cf6;
}

/* 连线样式 */
:deep(.vue-flow__edge-path) {
  stroke: #58a6ff;
  stroke-width: 2;
}

:deep(.vue-flow__edge:hover .vue-flow__edge-path) {
  stroke: #79c0ff;
  stroke-width: 3;
}

:deep(.vue-flow__connection-line) {
  stroke: #58a6ff;
  stroke-width: 2;
}

/* 连线箭头 */
:deep(.vue-flow__arrowhead) {
  fill: #58a6ff;
}

/* 连接点 */
:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background: #30363d;
  border: 2px solid #58a6ff;
  border-radius: 50%;
  transition: all 0.15s ease;
}

:deep(.vue-flow__handle:hover) {
  background: #58a6ff;
  transform: scale(1.3);
}

/* 控件按钮 */
:deep(.vue-flow__controls) {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

:deep(.vue-flow__controls-button) {
  background: #161b22;
  border-color: #21262d;
  fill: #8b949e;
}

:deep(.vue-flow__controls-button:hover) {
  background: #1c2333;
  fill: #e6edf3;
}

:deep(.vue-flow__controls-button svg) {
  fill: #8b949e;
}
</style>
