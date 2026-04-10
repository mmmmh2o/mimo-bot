# 插件开发

## 概述

MiMo Bot 通过插件系统扩展功能。插件可以添加新节点类型、工具、AI 适配器和存储实现。

## 插件目录结构

```
plugins/
└── my-plugin/
    ├── manifest.json      ← 插件描述文件
    ├── index.js           ← 入口文件
    ├── nodes/             ← 节点实现（可选）
    │   └── my-node.js
    └── README.md          ← 插件说明（可选）
```

## manifest.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的自定义插件",
  "type": "node",
  "entry": "index.js",
  "author": "yourname",
  "minAppVersion": "0.1.0",
  "dependencies": {
    "some-lib": "^1.0.0"
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| name | ✅ | 唯一标识符 |
| version | ✅ | 语义化版本 |
| description | ✅ | 描述 |
| type | ✅ | `node` / `tool` / `adapter` / `storage` |
| entry | ❌ | 入口文件，默认 `index.js` |
| author | ❌ | 作者 |
| minAppVersion | ❌ | 最低兼容版本 |
| dependencies | ❌ | npm 依赖（自动安装） |

## 插件类型

### 节点插件 (node)

添加新的流程节点类型。

```javascript
// plugins/my-node/index.js

/**
 * 自定义节点：发送邮件
 * 
 * 在流程中发送邮件通知
 */
export const sendEmail = {
  /** 节点类型标识 */
  type: 'send-email',

  /** UI 显示信息 */
  meta: {
    label: '📧 发送邮件',
    category: '通知',
    description: '发送邮件通知',
  },

  /** 表单字段定义（用于 UI 渲染配置面板） */
  schema: {
    to: { type: 'string', label: '收件人', required: true },
    subject: { type: 'string', label: '主题', required: true },
    body: { type: 'text', label: '正文', supportVariables: true },
  },

  /**
   * 执行节点
   * @param {object} data - 节点配置
   * @param {object} ctx - 执行上下文
   * @param {VariableEngine} ctx.variables - 变量引擎
   * @param {BrowserController} ctx.browser - 浏览器控制器
   * @param {Database} ctx.db - 数据库
   * @param {function} ctx.emit - 事件推送
   */
  async execute(data, ctx) {
    const to = ctx.variables.render(data.to)
    const subject = ctx.variables.render(data.subject)
    const body = ctx.variables.render(data.body)

    // 发送邮件逻辑...
    const result = await sendMail(to, subject, body)

    // 设置输出变量
    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, result, 'runtime')
    }

    ctx.emit('node:completed', { nodeId: data.id })
  },
}
```

### 工具插件 (tool)

添加可在节点中调用的工具函数。

```javascript
// plugins/my-tools/index.js

export const httpRequest = {
  type: 'http-request',
  meta: {
    label: '🌐 HTTP 请求',
    category: '工具',
  },

  schema: {
    url: { type: 'string', label: 'URL', required: true },
    method: { type: 'select', label: '方法', options: ['GET', 'POST', 'PUT'] },
    headers: { type: 'json', label: '请求头' },
    body: { type: 'text', label: '请求体', supportVariables: true },
  },

  async execute(data, ctx) {
    const url = ctx.variables.render(data.url)
    const method = data.method || 'GET'

    const response = await fetch(url, {
      method,
      headers: data.headers || {},
      body: data.body ? ctx.variables.render(data.body) : undefined,
    })

    const result = await response.text()

    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, result, 'runtime')
    }
  },
}
```

### 适配器插件 (adapter)

添加新的 AI 网站支持。详见 [适配器开发](./adapters.md)。

```javascript
// plugins/new-ai-adapter/index.js
import { BaseAdapter } from '../../core/adapters/base-adapter.js'

export class NewAIAdapter extends BaseAdapter {
  name = 'new-ai'
  url = 'https://new-ai.com'
  // ... 实现接口方法
}
```

## 生命周期

```
加载流程:
1. PluginManager.scan() 扫描 plugins/ 目录
2. 读取每个插件的 manifest.json
3. 动态 import(entry) 加载模块
4. 注册到对应类型的注册表

执行流程:
1. engine._executeNode() 收到节点
2. 查询插件注册表中是否有该 type
3. 调用插件的 execute(data, ctx)
4. ctx 注入了 variables / browser / db / emit

卸载流程:
1. PluginManager.unload(name)
2. 从注册表中移除
```

## 依赖注入上下文 (ctx)

插件 `execute` 方法接收的 `ctx` 对象：

```javascript
ctx = {
  // 变量引擎 — 读写流程变量
  variables: {
    get(name): any,
    set(name, value, scope): void,
    render(template): string,      // {{变量}} 模板渲染
    exportAll(): object,
  },

  // 浏览器控制器 — 操作 AI 网页
  browser: {
    getPage(): Page,               // Playwright Page 实例
    sendMessage(text, opts): Promise,
    waitForReply(opts): Promise<string>,
    screenshot(): Promise<Buffer>,
  },

  // 数据库 — 读写数据
  db: {
    get(table, id): any,
    query(table, filter): any[],
    insert(table, data): void,
    update(table, id, data): void,
    delete(table, id): void,
  },

  // 事件推送 — 通知 UI
  emit(event, data): void,

  // 日志
  log: {
    info(msg, data): void,
    warn(msg, data): void,
    error(msg, data): void,
  },

  // 应用设置
  settings: {
    get(key): any,
    getAll(): object,
  },
}
```

## 错误隔离

插件执行出错时不会影响主流程：

```javascript
// PluginManager 内部处理
try {
  await plugin.module[nodeType].execute(data, ctx)
} catch (error) {
  log.error(`插件 ${plugin.name} 执行失败`, error)
  ctx.emit('node:error', {
    nodeId: data.id,
    plugin: plugin.name,
    error: error.message,
  })
  // 根据配置决定继续还是终止
  if (data.continueOnError) {
    // 跳过此节点，继续执行
  } else {
    throw error
  }
}
```

## 示例：完整插件

```javascript
// plugins/code-executor/index.js
// 一个执行代码并返回结果的插件

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

export const executeCode = {
  type: 'execute-code',
  meta: {
    label: '⚡ 执行代码',
    category: '开发',
    description: '执行 Python/JS/Shell 代码并返回输出',
  },
  schema: {
    language: {
      type: 'select',
      label: '语言',
      options: ['python', 'javascript', 'shell'],
      required: true,
    },
    code: {
      type: 'code',
      label: '代码',
      supportVariables: true,
      required: true,
    },
    timeout: { type: 'number', label: '超时(秒)', default: 30 },
    workingDir: { type: 'string', label: '工作目录' },
    outputVariable: { type: 'string', label: '输出变量' },
  },

  async execute(data, ctx) {
    const code = ctx.variables.render(data.code)
    const timeout = (data.timeout || 30) * 1000
    const cwd = data.workingDir
      ? ctx.variables.render(data.workingDir)
      : process.cwd()

    // 写临时文件
    const exts = { python: 'py', javascript: 'js', shell: 'sh' }
    const ext = exts[data.language] || 'txt'
    const tmpFile = join(cwd, `._mimo_exec_${Date.now()}.${ext}`)
    await writeFile(tmpFile, code, 'utf-8')

    // 执行
    const cmds = {
      python: `python "${tmpFile}"`,
      javascript: `node "${tmpFile}"`,
      shell: `bash "${tmpFile}"`,
    }

    try {
      const { stdout, stderr } = await execAsync(cmds[data.language], {
        cwd,
        timeout,
      })
      const output = stdout || stderr

      if (data.outputVariable) {
        ctx.variables.set(data.outputVariable, output, 'runtime')
      }

      ctx.emit('node:completed', {
        nodeId: data.id,
        output: output.slice(0, 500), // 截断推送
      })
    } catch (error) {
      throw new Error(`代码执行失败: ${error.message}`)
    }
  },
}
```

## UI 集成

插件的 `schema` 字段会自动渲染为配置面板的表单。流程编辑器中会显示插件注册的节点类型，拖拽即可使用。

插件无需编写前端代码。
