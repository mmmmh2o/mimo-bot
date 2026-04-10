# 节点类型参考

## 内置节点

### 🟢 开始 (start)

流程入口，设置输入变量和触发方式。

```json
{
  "id": "start_1",
  "type": "start",
  "data": {
    "trigger": "manual",
    "inputVariables": {
      "project_name": "订单系统",
      "requirements": "用户需要..."
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| trigger | string | `manual` / `schedule` / `webhook` |
| inputVariables | object | 初始变量，key-value 形式 |

---

### 💬 发送消息 (send-message)

向 AI 发送消息，可选等待回复。

```json
{
  "id": "msg_1",
  "type": "send-message",
  "data": {
    "content": "请分析{{project_name}}的需求",
    "waitForReply": true,
    "timeout": 120,
    "typingSpeed": [50, 150],
    "delayBeforeSend": [1000, 3000],
    "outputVariable": "reply_1"
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | string | — | 消息内容，支持 `{{变量}}` |
| waitForReply | boolean | true | 是否等待 AI 回复 |
| timeout | number | 120 | 等待回复超时（秒） |
| typingSpeed | [min, max] | [50, 150] | 模拟打字速度范围（ms/字符） |
| delayBeforeSend | [min, max] | [1000, 3000] | 发送前随机延迟（ms） |
| outputVariable | string | — | 将回复存入此变量 |

---

### ⏳ 等待回复 (wait-reply)

单独等待 AI 回复，不发送新消息。

```json
{
  "id": "wait_1",
  "type": "wait-reply",
  "data": {
    "timeout": 180,
    "outputVariable": "reply_2"
  }
}
```

---

### 🔀 条件分支 (condition)

根据变量值选择执行路径。

```json
{
  "id": "branch_1",
  "type": "condition",
  "data": {
    "sourceVariable": "last_reply",
    "condition": {
      "type": "contains",
      "target": "错误"
    }
  }
}
```

条件类型：

| type | 说明 | 示例 |
|------|------|------|
| contains | 包含关键词 | `"target": "错误"` |
| not-contains | 不包含 | `"target": "成功"` |
| equals | 精确匹配 | `"target": "PASS"` |
| regex | 正则匹配 | `"target": "CREATE TABLE.*"` |
| greater-than | 数值大于 | `"target": "5"` |
| less-than | 数值小于 | `"target": "3"` |

分支通过 edges 的 `condition` 字段连接：

```json
{
  "edges": [
    { "source": "branch_1", "target": "retry_node", "condition": "true" },
    { "source": "branch_1", "target": "next_step", "condition": "false" }
  ]
}
```

---

### 🔁 循环 (loop)

遍历数组变量，逐项执行子流程。

```json
{
  "id": "loop_1",
  "type": "loop",
  "data": {
    "sourceVariable": "requirements",
    "itemVariable": "current_req",
    "indexVariable": "req_index",
    "maxIterations": 50
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| sourceVariable | string | 数组类型的变量名 |
| itemVariable | string | 当前项变量名 |
| indexVariable | string | 当前索引变量名 |
| maxIterations | number | 最大循环次数（防死循环） |

---

### 📁 读取文件 (read-file)

读取文件内容存入变量。

```json
{
  "id": "read_1",
  "type": "read-file",
  "data": {
    "path": "./data/requirements.md",
    "outputVariable": "requirements",
    "encoding": "utf-8"
  }
}
```

---

### 💾 保存输出 (save)

将变量内容写入文件。

```json
{
  "id": "save_1",
  "type": "save",
  "data": {
    "variable": "generated_code",
    "path": "./workspace/projects/{{project_name}}/main.py",
    "append": false
  }
}
```

---

### 📦 设置变量 (set-variable)

手动设置或修改变量。

```json
{
  "id": "set_1",
  "type": "set-variable",
  "data": {
    "name": "step",
    "value": "design",
    "scope": "runtime"
  }
}
```

---

### 🌐 网页抓取 (scrape)

从网页抓取数据存入变量和数据库。

```json
{
  "id": "scrape_1",
  "type": "scrape",
  "data": {
    "url": "https://example.com/requirements",
    "method": "css",
    "selector": ".req-item",
    "extract": {
      "title": "h3",
      "content": "p.desc"
    },
    "outputVariable": "scraped_reqs",
    "saveToDb": true
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| url | string | 目标 URL，支持 `{{变量}}` |
| method | string | `css` / `xpath` / `full-text` |
| selector | string | 容器选择器 |
| extract | object | 字段 → 选择器映射 |
| outputVariable | string | 输出变量名 |
| saveToDb | boolean | 是否同时存入数据库 |

---

### 🙋 人工介入 (human-handoff)

暂停流程，等待人工操作后继续。

```json
{
  "id": "handoff_1",
  "type": "human-handoff",
  "data": {
    "message": "需要确认生成的代码是否正确",
    "resumeMode": "click",
    "timeout": 0,
    "timeoutAction": "wait"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| message | string | 暂停时显示的提示 |
| resumeMode | string | `click`（点继续）/ `input`（输入确认文字） |
| timeout | number | 超时秒数，0 = 无限等待 |
| timeoutAction | string | `continue` / `stop` / `wait` |

---

### ⏰ 延时等待 (delay)

暂停指定秒数。

```json
{
  "id": "delay_1",
  "type": "delay",
  "data": {
    "seconds": 10
  }
}
```

---

### 🔧 运行命令 (run-command)

执行本地 shell 命令。

```json
{
  "id": "cmd_1",
  "type": "run-command",
  "data": {
    "command": "python test.py",
    "workingDir": "./workspace/projects/{{project_name}}",
    "captureOutput": true,
    "outputVariable": "test_result",
    "timeout": 60
  }
}
```

---

### 📤 提取变量 (extract)

从已有变量中通过正则或代码块提取数据。

```json
{
  "id": "extract_1",
  "type": "extract",
  "data": {
    "sourceVariable": "reply_1",
    "rules": [
      {
        "type": "regex",
        "pattern": "评分[：:](\\d+)",
        "variable": "score"
      },
      {
        "type": "code-block",
        "language": "python",
        "variable": "python_code"
      }
    ]
  }
  }
}
```

提取规则类型：

| type | 说明 |
|------|------|
| regex | 正则匹配，第一个捕获组作为值 |
| code-block | 提取指定语言的代码块 |
| json-path | JSON 路径提取（需源为 JSON） |

---

### 🏁 结束 (end)

流程终点，触发保存和通知。

```json
{
  "id": "end_1",
  "type": "end",
  "data": {
    "notify": true,
    "saveConversation": true,
    "gitSync": true
  }
}
```

---

## 自定义节点

通过插件系统添加新节点类型。详见 [插件开发](./plugins.md)。

```
plugins/
└── my-node/
    ├── manifest.json
    └── index.js    ← 导出节点实现
```
