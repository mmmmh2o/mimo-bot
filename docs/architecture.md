# 架构设计

## 概览

MiMo Bot 是一个 Electron 桌面应用，核心能力是**用 Playwright 控制内置 Chromium 浏览器操作 AI 网页**，通过可视化流程编排实现自动化对话。

```
┌──────────────────────────────────────────────────────────────┐
│                     Electron App                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Vue3 前端 (Renderer Process)               │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐ │  │
│  │  │仪表盘 │ │流程   │ │变量   │ │数据库 │ │日志   │ │设置  │ │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └─────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │ IPC (Context Bridge)              │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │              Main Process (Node.js)                     │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────┐          │  │
│  │  │ 流程引擎  │  │ 变量引擎   │  │ 调度器      │          │  │
│  │  │ engine   │  │ variables │  │ scheduler  │          │  │
│  │  └────┬─────┘  └─────┬─────┘  └────────────┘          │  │
│  │       │              │                                 │  │
│  │  ┌────▼──────────────▼──────────────────────────────┐  │  │
│  │  │              插件系统 (PluginManager)              │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │  │
│  │  │  │ 节点插件  │ │ 工具插件  │ │   AI 适配器插件   │ │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘ │  │  │
│  │  └──────────────────┬───────────────────────────────┘  │  │
│  │                     │                                   │  │
│  │  ┌──────────────────▼───────────────────────────────┐  │  │
│  │  │              基础设施层                            │  │  │
│  │  │  ┌─────────┐ ┌──────────┐ ┌──────────┐          │  │  │
│  │  │  │ 抽象存储  │ │ Git 同步  │ │ 通知系统  │          │  │  │
│  │  │  │ Storage  │ │ git-sync │ │ notify   │          │  │  │
│  │  │  └─────────┘ └──────────┘ └──────────┘          │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │           Playwright 浏览器引擎                   │  │  │
│  │  │  ┌────────────────────────────────────────────┐  │  │  │
│  │  │  │         AI 适配器层 (Adapter Layer)         │  │  │  │
│  │  │  │  ┌─────┐ ┌────────┐ ┌─────────┐ ┌───────┐ │  │  │  │
│  │  │  │  │ MiMo │ │ ChatGPT │ │ DeepSeek │ │ Custom│ │  │  │  │
│  │  │  │  └─────┘ └────────┘ └─────────┘ └───────┘ │  │  │  │
│  │  │  └────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 进程模型

```
Electron 主进程 (main.js)
├── 管理应用生命周期
├── 创建浏览器窗口
├── 管理 Playwright 浏览器实例
├── 运行流程引擎
├── IPC 通信中枢
└── 系统托盘 & 快捷键

Renderer 进程 (Vue3)
├── UI 渲染（6个页面）
├── 用户交互
├── 通过 IPC 调用主进程功能
└── WebSocket 接收实时状态

Playwright 浏览器
├── 渲染 AI 网页（MiMo 等）
├── 接收主进程自动化指令
└── 用户可直接操作（人工接管）
```

## 核心模块

### 流程引擎 (engine.js)

```
输入: 流程 JSON 定义
输出: 执行结果 + 对话记录

执行流程:
1. 解析节点图 → 拓扑排序
2. 初始化变量池
3. 逐节点执行:
   a. 渲染模板 (变量替换)
   b. 执行节点动作
   c. 收集输出 → 提取变量
   d. 写日志
   e. 推送状态到 UI
   f. 检查暂停信号
4. 流程结束 → 保存 + 通知
```

### 变量引擎 (variables.js)

```
变量来源:
├── 输入变量 (用户配置)
├── 系统变量 (时间、计数器等)
├── 运行时变量 (节点间传递)
├── 提取变量 (从回复中解析)
└── 持久化变量 (跨流程保留)

变量操作:
├── 注入: 模板渲染时替换 {{var}}
├── 提取: 正则/JSONPath 从文本提取
├── 转换: 类型转换、格式化
└── 过滤: pipe 语法 {{var | filter}}
```

### AI 适配器层 (adapters/)

```
BaseAdapter (接口)
├── name: string
├── requiresBrowser: boolean
├── selectors: { ... }
├── login(page): Promise
├── isLoggedIn(page): Promise<boolean>
├── getChatInput(page): Locator
├── sendMessage(page, text): Promise
├── waitForReply(page): Promise<string>
└── detectReplyComplete(page): Promise<boolean>

每个适配器:
├── 定义目标网站的选择器
├── 定义登录流程
├── 定义消息发送/接收策略
└── 定义回复检测逻辑
```

### 插件系统 (plugins/)

```
PluginManager
├── scan(): 扫描插件目录
├── load(pluginDir): 加载单个插件
├── register(plugin): 注册到系统
└── getPlugins(type): 获取指定类型插件

插件类型:
├── node    → 新节点类型
├── tool    → 新工具
├── adapter → 新 AI 适配器
└── storage → 新存储实现
```

### 存储抽象层 (storage/)

```
BaseStorage (接口)
├── get(key): any
├── set(key, value): void
├── delete(key): void
├── query(filter): any[]
├── migrate(version): void
└── close(): void

实现:
├── SQLiteStorage (默认)
├── JSONFileStorage (轻量)
└── 可扩展 PostgreSQL / Redis
```

## 数据流

```
触发 (定时/手动/Webhook)
    │
    ▼
加载流程 JSON
    │
    ▼
初始化变量池 ──▶ 读取数据库/文件中的输入变量
    │
    ▼
┌─── 节点执行循环 ──────────────────────────┐
│                                           │
│  当前节点 ──▶ 模板渲染 ──▶ 执行动作        │
│                             │             │
│                    ┌────────┴────────┐    │
│                    │                 │    │
│               发送消息            工具执行   │
│               (Playwright)      (本地)      │
│                    │                 │    │
│                    └────────┬────────┘    │
│                             │             │
│                    收集输出 ──▶ 提取变量    │
│                             │             │
│                    写日志 ──▶ 推送 UI      │
│                             │             │
│                    检查分支 ──▶ 下一节点    │
│                                           │
└───────────────────────────────────────────┘
    │
    ▼
保存结果 ──▶ SQLite + 文件
    │
    ▼
GitHub 同步 ──▶ git push
    │
    ▼
通知用户
```

## 扩展性分析

### 当前架构的扩展能力

| 维度 | 评分 | 说明 |
|------|------|------|
| 节点系统 | ⚠️ 6/10 | switch 硬编码，新节点需改 engine.js |
| 适配器系统 | ✅ 8/10 | BaseAdapter 接口清晰，继承即可扩展 |
| 插件系统 | ⚠️ 5/10 | 能加载，但缺生命周期、依赖注入、错误隔离 |
| 数据库 | ✅ 9/10 | SQLite 加表即可 |
| 前端组件 | ✅ 8/10 | Vue3 组件化，新页面标准做法 |

### 待改进项

#### 1. 节点执行改为插件注册表

**问题**: `_executeNode()` 用 switch/case 硬编码所有节点类型，每次新增节点都需修改核心引擎。

**目标方案**:

```
engine._executeNode(node)
  → 查插件注册表: pluginManager.getNodeImplementation(node.type)
    → 有 → 执行插件的 execute(data, ctx)
    → 无 → 查内置节点表 builtins[node.type]
    → 都没有 → 抛出 UnknownNodeTypeError
```

内置节点也走注册表，不特殊对待。

#### 2. 插件系统增强

**问题**: 插件加载后没有初始化、没有依赖注入、崩溃会连累主进程。

**目标方案**:

```javascript
// 插件生命周期
PluginManager.load(pluginDir)
  → 读 manifest
  → import 模块
  → 调用 plugin.init(ctx)     // 注入依赖
  → 注册到类型表

PluginManager.unload(name)
  → 调用 plugin.destroy()     // 清理资源
  → 从类型表移除

// 依赖注入上下文
ctx = { variables, browser, db, emit, log, settings }

// 错误隔离
try {
  await plugin.execute(data, ctx)
} catch (error) {
  log.error(`插件 ${name} 崩溃`, error)
  if (data.continueOnError) skip()
  else throw error
}
```

#### 3. 事件总线

**问题**: 模块间通信靠回调传递 (`onEvent`)，耦合度高。

**目标方案**: 全局 EventEmitter，任意模块可订阅/发布。

```javascript
// 发布
eventBus.emit('flow:node-completed', { nodeId, step })

// 订阅（插件、UI、日志、Git 同步 都可独立订阅）
eventBus.on('flow:completed', syncToGitHub)
eventBus.on('flow:node-error', notifyUser)
eventBus.on('scrape:completed', triggerFlow)
```

### 扩展示例

有了以上改进后，添加新功能不动核心代码：

| 新功能 | 需要做什么 | 改 engine.js？ |
|--------|-----------|---------------|
| 新节点类型 | 写插件，注册到 PluginManager | ❌ |
| 新 AI 网站 | 继承 BaseAdapter | ❌ |
| 新存储后端 | 实现 BaseStorage 接口 | ❌ |
| 新触发方式 | 订阅事件总线 | ❌ |
| Webhook 集成 | 独立模块，监听事件 | ❌ |

---

## IPC 通信设计

```
Renderer → Main (调用):
├── flow:run(flowId) → 启动流程
├── flow:pause() → 暂停
├── flow:resume() → 恢复
├── flow:stop() → 终止
├── flow:getStatus() → 获取状态
├── variable:set(name, value)
├── variable:get(name)
├── db:query(table, filter)
├── settings:get() / settings:set()
├── scraper:run(config)
├── git:sync()
├── adapter:list() / adapter:switch(name)
└── browser:screenshot()

Main → Renderer (推送):
├── flow:node-started → 节点开始执行
├── flow:node-completed → 节点执行完成
├── flow:node-error → 节点执行失败
├── flow:variable-updated → 变量更新
├── flow:waiting-input → 等待人工输入
├── flow:completed → 流程完成
├── browser:url-changed → 页面 URL 变化
├── browser:screenshot-update → 截图更新
└── log:new → 新日志条目
```
