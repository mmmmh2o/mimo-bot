# 变量系统

## 概述

变量是流程中数据流动的血液。每个节点可以读取、修改、提取变量，变量在节点之间传递上下文。

## 变量作用域

| 作用域 | 生命周期 | 典型用途 |
|--------|---------|---------|
| `input` | 流程开始前设置，流程内只读 | 用户配置的参数 |
| `runtime` | 流程执行中产生，流程结束清除 | 节点间传递的中间结果 |
| `output` | 流程产出，流程结束持久化 | 最终结果 |
| `persistent` | 跨流程永久保留 | 项目上下文、长期状态 |

## 模板语法

在消息内容、文件路径等文本字段中使用 `{{变量名}}` 插入变量值：

```
请为 {{project_name}} 设计数据库 schema
技术栈：{{tech_stack}}
输出到：./workspace/projects/{{project_name}}/schema.sql
```

### 渲染规则

| 输入 | 变量值 | 输出 |
|------|--------|------|
| `"你好 {{name}}"` | `"世界"` | `"你好 世界"` |
| `"{{data}}"` | `{ a: 1 }` | `"{\n \"a\": 1\n}"` (JSON 格式化) |
| `"{{missing}}"` | undefined | `"{{missing}}"` (保留原样 + 警告) |

## 管道过滤器

变量支持管道语法 `{{变量 | 过滤器}}`，对值进行转换后再插入：

```
{{reply | upper}}           → 全部大写
{{reply | extract_code}}    → 提取代码块内容
{{items | length}}          → 数组长度
{{name | default:未设置}}    → 空值时使用默认值
```

### 字符串过滤器

| 过滤器 | 说明 | 示例 |
|--------|------|------|
| `upper` | 转大写 | `{{name \| upper}}` → `"HELLO"` |
| `lower` | 转小写 | `{{NAME \| lower}}` → `"hello"` |
| `trim` | 去除首尾空格 | `{{text \| trim}}` |
| `length` | 字符串长度 / 数组长度 | `{{items \| length}}` → `5` |
| `first` | 第一个字符 / 数组首项 | `{{list \| first}}` |
| `last` | 最后一个字符 / 数组末项 | `{{list \| last}}` |
| `slice:start,end` | 截取子串 | `{{text \| slice:0,100}}` |

### 提取过滤器

| 过滤器 | 说明 | 示例 |
|--------|------|------|
| `extract_code` | 提取第一个代码块 | `{{reply \| extract_code}}` |
| `extract_json` | 提取并解析 JSON | `{{reply \| extract_json}}` |
| `split_lines` | 按行拆分为数组 | `{{text \| split_lines}}` |

### 类型转换

| 过滤器 | 说明 | 示例 |
|--------|------|------|
| `json` | 字符串解析为 JSON | `{{data \| json}}` |
| `jsonstring` | 值序列化为 JSON 字符串 | `{{obj \| jsonstring}}` |

### 默认值

| 过滤器 | 说明 | 示例 |
|--------|------|------|
| `default:值` | 变量为空时使用默认值 | `{{name \| default:未命名}}` |

### 链式过滤器

可以串联多个过滤器，从左到右依次应用：

```
{{reply | extract_code | trim}}
{{name | lower | default:unknown}}
```

## 系统变量

内置变量，无需定义即可使用：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `$now` | 当前 ISO 时间 | `"2026-04-10T17:00:00.000Z"` |
| `$date` | 当前日期 | `"2026-04-10"` |
| `$time` | 当前时间 | `"17:00:00"` |
| `$timestamp` | Unix 时间戳 (ms) | `1775841600000` |

## 变量提取

从 AI 回复中自动提取数据到变量：

### 正则提取

```json
{
  "type": "extract",
  "data": {
    "sourceVariable": "reply_1",
    "rules": [
      {
        "type": "regex",
        "pattern": "综合评分[：:](\\d+)分",
        "variable": "score"
      },
      {
        "type": "regex",
        "pattern": "结论[：:]([\\s\\S]+?)(?=\\n\\n|$)",
        "variable": "conclusion"
      }
    ]
  }
}
```

### 代码块提取

自动提取指定语言的代码块：

```json
{
  "type": "extract",
  "data": {
    "sourceVariable": "reply_1",
    "rules": [
      { "type": "code-block", "language": "python", "variable": "main_py" },
      { "type": "code-block", "language": "sql", "variable": "schema_sql" },
      { "type": "code-block", "language": "javascript", "variable": "frontend_js" }
    ]
  }
}
```

提取逻辑：

```javascript
// 匹配 ```python ... ``` 代码块
const re = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 's')
const match = source.match(re)
// match[1] 就是代码内容
```

## 在代码中使用

```javascript
import { VariableEngine } from './variables.js'

const vars = new VariableEngine(db)

// 设置变量
vars.set('project_name', '订单系统', 'input')
vars.set('reply_count', 0, 'runtime')

// 获取变量
const name = vars.get('project_name')  // '订单系统'

// 模板渲染
const msg = vars.render('请分析{{project_name}}的需求')
// → '请分析订单系统的需求'

// 带过滤器
const code = vars.render('{{reply | extract_code | trim}}')

// 从文本提取
vars.extract('综合评分为85分', '综合评分为(\\d+)分', 'score')
// vars.get('score') → '85'

// 导出所有
const all = vars.exportAll()

// 重置运行时变量（保留 input 和 persistent）
vars.reset()
```

## 最佳实践

1. **用有意义的变量名** — `project_requirements` 比 `data1` 好
2. **合理选择作用域** — 输入用 `input`，中间结果用 `runtime`，产出用 `output`
3. **提取时做兜底** — 正则匹配可能失败，后续节点加条件判断
4. **避免变量名冲突** — 不同流程的变量独立，同一流程内注意命名
5. **大文本变量注意性能** — 超长文本的模板渲染会变慢
