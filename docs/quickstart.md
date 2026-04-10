# 快速开始

## 环境要求

- Node.js >= 20.0
- npm >= 10.0
- 桌面 Linux（GNOME / KDE / 其他）

## 安装

```bash
# 克隆项目
git clone https://github.com/yourname/mimo-bot.git
cd mimo-bot

# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium
```

## 启动

```bash
npm run dev
```

应用窗口会自动打开。

## 首次配置

### 1. 配置 MiMo

进入 **设置 → 浏览器**：

- MiMo URL 填入 `https://platform.xiaomimimo.com`
- 超时保持默认 `60000` ms
- 点击 **打开浏览器登录**

### 2. 登录 MiMo

弹出的浏览器窗口中：

- 正常登录你的 MiMo 账号
- 登录成功后回到设置页面
- 点击 **保存 Cookie**

Cookie 会持久化到本地，下次启动自动加载，无需重复登录。

### 3. 验证连接

设置页面会显示 Cookie 状态：

- ✅ 已保存 (2026-04-10) — 正常
- ❌ 未保存 — 需要重新登录

## 创建第一个流程

### 方式一：可视化编辑

1. 进入 **流程编辑器**
2. 从左侧拖入 **🟢 开始** 节点
3. 连接 **💬 发送消息** 节点，输入：
   ```
   你好，请介绍一下你自己
   ```
4. 连接 **⏳ 等待回复** 节点
5. 连接 **🏁 结束** 节点
6. 点击 **▶ 运行**

### 方式二：JSON 配置

创建文件 `workspace/flows/hello.json`：

```json
{
  "name": "打招呼",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "data": {}
    },
    {
      "id": "msg1",
      "type": "send-message",
      "data": {
        "content": "你好，请介绍一下你自己",
        "waitForReply": true,
        "timeout": 60,
        "outputVariable": "reply"
      }
    },
    {
      "id": "end",
      "type": "end",
      "data": {
        "saveConversation": true
      }
    }
  ],
  "edges": [
    { "source": "start", "target": "msg1" },
    { "source": "msg1", "target": "end" }
  ]
}
```

## 运行流程

1. 在流程编辑器中点击 **▶ 运行**
2. 底部状态栏显示进度
3. 侧边栏实时更新变量和日志
4. MiMo 页面中可以看到 bot 正在打字

### 人工接管

运行过程中：

- 点击 **⏸ 暂停** — bot 停手
- 直接在 MiMo 页面上操作（打字、点击）
- 完成后点击 **▶ 继续** — bot 读取当前页面状态，接着执行

## 查看结果

### 对话记录

进入 **日志** 页面，可以看到：

- 每次运行的时间线
- 每个节点的输入/输出
- 变量变化记录

### 产出文件

如果流程中有 **💾 保存** 节点，产出会保存到 `workspace/projects/` 目录。

### GitHub 同步

配置 GitHub 后，每次流程完成自动：

```
git add -A
git commit -m "流程运行: 打招呼 - 2026-04-10 17:00"
git push
```

## 多轮对话示例

### 需求分析 → 设计 → 编码

```json
{
  "name": "软件开发",
  "variables": {
    "project_name": { "value": "订单系统", "scope": "input" },
    "requirements": { "value": "用户需要CRUD操作", "scope": "input" }
  },
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "data": {}
    },
    {
      "id": "msg1",
      "type": "send-message",
      "data": {
        "content": "项目：{{project_name}}\n需求：{{requirements}}\n请分析需求并给出系统设计方案",
        "waitForReply": true,
        "timeout": 120,
        "outputVariable": "design"
      }
    },
    {
      "id": "extract1",
      "type": "extract",
      "data": {
        "sourceVariable": "design",
        "rules": [
          {
            "type": "code-block",
            "language": "sql",
            "variable": "schema_sql"
          }
        ]
      }
    },
    {
      "id": "msg2",
      "type": "send-message",
      "data": {
        "content": "根据以下设计，生成完整的 FastAPI 代码：\n\n{{design}}\n\n数据库 Schema：\n{{schema_sql}}",
        "waitForReply": true,
        "timeout": 180,
        "outputVariable": "code"
      }
    },
    {
      "id": "extract2",
      "type": "extract",
      "data": {
        "sourceVariable": "code",
        "rules": [
          {
            "type": "code-block",
            "language": "python",
            "variable": "main_py"
          }
        ]
      }
    },
    {
      "id": "save1",
      "type": "save",
      "data": {
        "variable": "main_py",
        "path": "./workspace/projects/{{project_name}}/main.py"
      }
    },
    {
      "id": "save2",
      "type": "save",
      "data": {
        "variable": "schema_sql",
        "path": "./workspace/projects/{{project_name}}/schema.sql"
      }
    },
    {
      "id": "end",
      "type": "end",
      "data": {
        "saveConversation": true,
        "gitSync": true,
        "notify": true
      }
    }
  ],
  "edges": [
    { "source": "start", "target": "msg1" },
    { "source": "msg1", "target": "extract1" },
    { "source": "extract1", "target": "msg2" },
    { "source": "msg2", "target": "extract2" },
    { "source": "extract2", "target": "save1" },
    { "source": "save1", "target": "save2" },
    { "source": "save2", "target": "end" }
  ]
}
```

## 下一步

- [节点类型参考](./nodes.md) — 了解所有可用节点
- [AI 适配器开发](./adapters.md) — 支持更多 AI 网站
- [插件开发](./plugins.md) — 扩展功能
- [API 参考](./api.md) — IPC 接口完整列表
- [架构设计](./architecture.md) — 理解内部原理
