# MiMo Bot

> 网页特化版 AI 自动化工具 — 把 AI 变成你的员工

MiMo Bot 是一个基于 Electron 的桌面应用，内置浏览器引擎，能像人类一样操作 AI 网页（MiMo、ChatGPT、DeepSeek 等）。通过可视化流程编辑器编排多轮对话，支持变量系统、网页抓取、数据库存储、GitHub 同步，以及人工随时接管。

## ✨ 特性

- 🌐 **内置浏览器** — 就是真实浏览器，零兼容问题
- 🔀 **可视化流程编排** — 拖拽节点定义对话逻辑
- 📦 **变量系统** — 数据在节点间流动，支持管道过滤器
- 🕷️ **网页抓取** — 自动从网页获取信息存入数据库
- 🙋 **人工接管** — 随时暂停 bot，自己操作，再恢复
- ⏰ **定时运行** — cron 调度，自动执行任务
- 🔄 **GitHub 同步** — 对话记录、代码产出自动备份
- 🔌 **插件系统** — 可扩展节点、工具、AI 适配器
- ⚙️ **全 UI 配置** — 所有设置都走图形界面，零命令行

## 📦 安装

```bash
# 克隆项目
git clone https://github.com/yourname/mimo-bot.git
cd mimo-bot

# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium

# 启动开发模式
npm run dev
```

## 🚀 快速开始

1. 打开应用，进入 **设置 → 浏览器**，配置 MiMo URL
2. 点击 **打开浏览器登录**，手动登录 MiMo
3. 保存 Cookie
4. 进入 **流程编辑器**，拖拽节点编排流程
5. 点击 **运行**，观察 bot 自动操作

详见 [快速开始指南](./docs/quickstart.md)

## 📁 项目结构

```
mimo-bot/
├── electron/
│   ├── main.js              # Electron 主进程入口
│   └── preload.js           # 预加载脚本（IPC Bridge）
├── core/
│   ├── engine.js            # 流程执行引擎
│   ├── browser-controller.js # Playwright 浏览器控制
│   ├── variables.js         # 变量引擎（模板渲染 + 管道过滤器）
│   ├── database.js          # SQLite 数据库操作
│   ├── scraper.js           # 网页抓取引擎
│   ├── git-sync.js          # GitHub 同步（simple-git）
│   ├── scheduler.js         # 定时任务（node-cron）
│   ├── settings.js          # 配置管理
│   ├── adapters/
│   │   └── base-adapter.js  # AI 适配器基类
│   └── plugins/
│       └── plugin-manager.js # 插件加载器
├── renderer/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.js          # Vue 入口
│       ├── App.vue           # 根组件
│       ├── views/            # 6 个核心页面
│       ├── components/       # 通用组件
│       └── stores/           # Pinia 状态管理
├── data/                     # 运行时数据（SQLite、Cookie、设置）
├── workspace/                # GitHub 同步目录
│   ├── conversations/        # 对话记录
│   ├── projects/             # 产出代码
│   └── flows/                # 流程定义
├── plugins/                  # 外部插件安装目录
└── docs/                     # 文档
```

## 📖 文档

- [快速开始](./docs/quickstart.md) — 安装、配置、第一个流程
- [架构设计](./docs/architecture.md) — 进程模型、模块设计、扩展性分析
- [开发规范](./docs/development.md) — 代码规范、命名、Git 工作流
- [节点类型参考](./docs/nodes.md) — 全部 13 种内置节点
- [AI 适配器开发](./docs/adapters.md) — 接口定义、开发教程、调试技巧
- [插件开发](./docs/plugins.md) — 插件结构、生命周期、依赖注入
- [数据库 Schema](./docs/database.md) — 表结构、字段说明
- [变量系统](./docs/variables.md) — 模板语法、管道过滤器、作用域
- [API 参考](./docs/api.md) — IPC 接口完整列表 + 事件推送

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron 30+ |
| 浏览器控制 | Playwright |
| 前端 | Vue 3 + Vite + Element Plus |
| 节点编辑器 | vue-flow |
| 数据库 | better-sqlite3 |
| 状态管理 | Pinia |
| 定时任务 | node-cron |
| Git 同步 | simple-git |

## 📄 License

MIT
