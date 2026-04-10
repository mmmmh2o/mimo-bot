# 开发规范

## 技术栈

| 项 | 选择 | 版本要求 |
|---|---|---|
| 运行时 | Node.js | >= 20.0 |
| 包管理 | npm | >= 10.0 |
| 框架 | Electron | >= 30.0 |
| 浏览器控制 | Playwright | >= 1.45 |
| 前端框架 | Vue 3 | >= 3.4 |
| 构建工具 | Vite | >= 5.0 |
| UI 组件库 | Element Plus | >= 2.8 |
| 节点编辑器 | @vue-flow/core | >= 1.40 |
| 状态管理 | Pinia | >= 2.1 |
| 数据库 | better-sqlite3 | >= 11.0 |
| Git 操作 | simple-git | >= 3.25 |
| 定时任务 | node-cron | >= 3.0 |
| 日志 | electron-log | >= 5.0 |

## 代码规范

### 语言

- 后端（electron/、core/）：JavaScript（ES Modules）
- 前端（renderer/）：Vue 3 + JavaScript
- 不使用 TypeScript（降低复杂度，个人项目够用）

### 命名规范

```
文件名:      kebab-case     flow-engine.js, chat-input.vue
目录名:      kebab-case     adapters/, node-types/
变量名:      camelCase      flowEngine, currentNode
常量名:      UPPER_SNAKE    MAX_RETRY, DEFAULT_TIMEOUT
类名:        PascalCase     BaseAdapter, FlowEngine
组件名:      PascalCase     FlowEditor.vue, VarPanel.vue
事件名:      kebab-case     node-completed, flow-error
数据库表名:  snake_case     scraped_data, conversation_logs
```

### 文件组织

```
每个模块一个目录，index.js 做入口:

core/adapters/
├── index.js           ← 导出所有适配器 + 注册逻辑
├── base-adapter.js    ← 接口定义
├── mimo.js            ← MiMo 适配器
└── chatgpt.js         ← ChatGPT 适配器

core/nodes/
├── index.js           ← 导出所有节点类型
├── base-node.js       ← 节点基类
├── send-message.js
├── wait-reply.js
└── condition.js
```

### 模块导入

```javascript
// ✅ 正确: 使用 ES Module
import { FlowEngine } from './engine.js'
import { SQLiteStorage } from './storage/sqlite.js'

// ❌ 错误: 不用 CommonJS
const { FlowEngine } = require('./engine')
```

### 异步处理

```javascript
// ✅ 正确: async/await
async function sendMessage(page, text) {
  const input = await page.locator('.chat-input')
  await input.fill(text)
  await page.click('.send-button')
}

// ✅ 错误处理必须有
async function safeExecute(node, context) {
  try {
    return await node.execute(context)
  } catch (error) {
    logger.error(`节点 ${node.id} 执行失败`, error)
    throw new NodeExecutionError(node.id, error)
  }
}

// ❌ 错误: 不要裸 Promise
function sendMessage(page, text) {
  return page.locator('.chat-input').fill(text).then(...)
}
```

### 日志规范

```javascript
import log from 'electron-log'

// 使用 electron-log，自动写入文件
log.info('流程开始执行', { flowId, trigger })
log.warn('Cookie 即将过期', { expiresIn: '2h' })
log.error('节点执行失败', { nodeId, error: error.message })
log.debug('DOM 变化检测', { selector, changeType })

// 日志级别
// error: 需要人工介入的错误
// warn:  不影响运行但需要注意
// info:  正常运行记录
// debug: 详细调试信息（开发时用）
```

### 注释规范

```javascript
/**
 * 发送消息到 AI 网页
 * 
 * @param {import('playwright').Page} page - Playwright 页面实例
 * @param {string} text - 要发送的文本，支持 {{变量}} 语法
 * @param {object} options - 配置项
 * @param {number} options.typingSpeed - 打字速度 (ms/字符)
 * @param {number} options.delayBeforeSend - 发送前延迟 (ms)
 * @returns {Promise<void>}
 */
async function sendMessage(page, text, options = {}) {
  // 实现...
}
```

### 错误处理

```javascript
// 定义业务错误类型
class FlowExecutionError extends Error {
  constructor(flowId, nodeId, cause) {
    super(`流程 ${flowId} 在节点 ${nodeId} 执行失败`)
    this.name = 'FlowExecutionError'
    this.flowId = flowId
    this.nodeId = nodeId
    this.cause = cause
  }
}

class AdapterError extends Error {
  constructor(adapterName, operation, cause) {
    super(`适配器 ${adapterName} 的 ${operation} 操作失败`)
    this.name = 'AdapterError'
    this.adapterName = adapterName
    this.operation = operation
    this.cause = cause
  }
}

class VariableError extends Error {
  constructor(variableName, message) {
    super(`变量 ${variableName}: ${message}`)
    this.name = 'VariableError'
    this.variableName = variableName
  }
}
```

## 前端规范

### Vue 组件

```vue
<template>
  <!-- 模板 -->
</template>

<script setup>
// Composition API，不用 Options API
import { ref, computed, onMounted } from 'vue'
import { useFlowStore } from '@/stores/flow'

const flowStore = useFlowStore()

const selectedNode = ref(null)

const nodeCount = computed(() => flowStore.nodes.length)

onMounted(() => {
  flowStore.loadFlow()
})
</script>

<style scoped>
/* 组件样式，使用 scoped */
</style>
```

### 状态管理 (Pinia)

```javascript
// stores/flow.js
import { defineStore } from 'pinia'

export const useFlowStore = defineStore('flow', {
  state: () => ({
    currentFlow: null,
    nodes: [],
    edges: [],
    isRunning: false,
    isPaused: false,
  }),

  getters: {
    nodeById: (state) => (id) => {
      return state.nodes.find(n => n.id === id)
    },
  },

  actions: {
    async loadFlow(id) {
      const flow = await window.api.flow.get(id)
      this.currentFlow = flow
      this.nodes = flow.nodes
      this.edges = flow.edges
    },

    async runFlow() {
      this.isRunning = true
      await window.api.flow.run(this.currentFlow.id)
    },
  },
})
```

### API 调用

```javascript
// renderer/src/api/flow.js
// 所有 API 调用通过 window.api (IPC bridge)

export const flowApi = {
  list: () => window.api.invoke('flow:list'),
  get: (id) => window.api.invoke('flow:get', id),
  save: (flow) => window.api.invoke('flow:save', flow),
  delete: (id) => window.api.invoke('flow:delete', id),
  run: (id) => window.api.invoke('flow:run', id),
  pause: () => window.api.invoke('flow:pause'),
  resume: () => window.api.invoke('flow:resume'),
  stop: () => window.api.invoke('flow:stop'),
  getStatus: () => window.api.invoke('flow:getStatus'),
}
```

## 流程 JSON 规范

```jsonc
{
  // 流程元信息
  "id": "flow-uuid",
  "name": "日常开发任务",
  "description": "自动化软件开发流程",
  "version": "1.0.0",
  "createdAt": "2026-04-10T16:00:00Z",
  "updatedAt": "2026-04-10T17:00:00Z",

  // AI 适配器
  "adapter": {
    "type": "mimo",
    "config": {
      "url": "https://platform.xiaomimimo.com",
      "selectors": {}
    }
  },

  // 节点列表
  "nodes": [
    {
      "id": "start_1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": {
        "trigger": "manual",
        "inputVariables": {
          "project_name": "订单管理系统",
          "tech_stack": "Python + FastAPI + SQLite"
        }
      }
    },
    {
      "id": "msg_1",
      "type": "send-message",
      "position": { "x": 100, "y": 250 },
      "data": {
        "content": "请为{{project_name}}设计数据库schema，技术栈：{{tech_stack}}",
        "waitForReply": true,
        "timeout": 120,
        "typingSpeed": [50, 150],
        "delayBeforeSend": [1000, 3000],
        "outputVariable": "reply_1"
      }
    },
    {
      "id": "extract_1",
      "type": "extract",
      "position": { "x": 100, "y": 400 },
      "data": {
        "sourceVariable": "reply_1",
        "rules": [
          {
            "type": "regex",
            "pattern": "CREATE TABLE[\\s\\S]*?;",
            "variable": "sql_schema",
            "dataType": "code"
          },
          {
            "type": "code-block",
            "language": "sql",
            "variable": "sql_code",
            "dataType": "code"
          }
        ]
      }
    },
    {
      "id": "save_1",
      "type": "save",
      "position": { "x": 100, "y": 550 },
      "data": {
        "variable": "sql_schema",
        "filePath": "./workspace/projects/{{project_name}}/schema.sql",
        "format": "raw"
      }
    }
  ],

  // 连线
  "edges": [
    { "id": "e1", "source": "start_1", "target": "msg_1" },
    { "id": "e2", "source": "msg_1", "target": "extract_1" },
    { "id": "e3", "source": "extract_1", "target": "save_1" }
  ],

  // 全局变量
  "variables": {
    "project_name": { "type": "string", "value": "订单管理系统", "scope": "input" },
    "tech_stack": { "type": "string", "value": "Python + FastAPI + SQLite", "scope": "input" }
  }
}
```

## Git 规范

### 分支

```
main        ← 稳定版本
dev         ← 开发分支
feature/*   ← 功能分支
fix/*       ← 修复分支
```

### Commit 信息

```
格式: <type>(<scope>): <description>

type:
  feat:     新功能
  fix:      修复
  refactor: 重构
  docs:     文档
  style:    格式
  test:     测试
  chore:    构建/工具

示例:
  feat(engine): 添加条件分支节点支持
  fix(adapter): 修复 MiMo 回复检测超时
  docs(api): 更新 IPC 接口文档
  refactor(storage): 抽象存储层接口
```

## 测试规范

```
每个核心模块写单元测试:
├── core/__tests__/
│   ├── engine.test.js
│   ├── variables.test.js
│   └── adapters/
│       └── mimo.test.js

使用 Node.js 内置 test runner:
import { test, describe } from 'node:test'
import assert from 'node:assert'
```

## 构建与发布

```bash
# 开发
npm run dev

# 构建
npm run build          # 当前平台
npm run build:linux    # Linux AppImage
npm run build:win      # Windows exe
npm run build:mac      # macOS dmg
```
