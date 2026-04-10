# 数据库 Schema

MiMo Bot 使用 SQLite（better-sqlite3），数据库文件位于 `data/bot.db`。

## 表总览

| 表名 | 说明 | 核心操作 |
|------|------|---------|
| flows | 流程定义 | CRUD |
| variables | 持久化变量 | CRUD |
| conversations | 对话记录 | 追加写入 |
| scraped_data | 网页抓取数据 | 追加写入 |
| projects | 项目管理 | CRUD |
| settings | 应用设置 | Key-Value |
| scrape_tasks | 抓取任务 | CRUD |

## 表结构

### flows

流程定义，每个流程的节点图以 JSON 存储在 `data` 字段。

```sql
CREATE TABLE flows (
  id          TEXT PRIMARY KEY,              -- UUID
  name        TEXT NOT NULL,                 -- 流程名称
  description TEXT,                          -- 描述
  data        TEXT NOT NULL,                 -- JSON: { nodes, edges, variables, adapter }
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

`data` 字段 JSON 结构：

```json
{
  "nodes": [...],
  "edges": [...],
  "variables": { "var_name": { "value": "...", "scope": "input" } },
  "adapter": { "type": "mimo", "config": {} }
}
```

### variables

持久化变量，跨流程保留。

```sql
CREATE TABLE variables (
  name       TEXT PRIMARY KEY,               -- 变量名
  value      TEXT,                            -- 值（JSON 序列化）
  type       TEXT DEFAULT 'string',           -- 类型
  scope      TEXT DEFAULT 'persistent',       -- 作用域
  updated_at TEXT DEFAULT (datetime('now'))
);
```

| scope | 说明 |
|-------|------|
| input | 流程开始前设置，流程内只读 |
| runtime | 流程执行中产生，流程结束清除 |
| output | 流程产出，流程结束持久化 |
| persistent | 跨流程永久保留 |

### conversations

对话记录，每次运行产生的所有消息。

```sql
CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id    TEXT,                            -- 关联的流程 ID
  run_id     TEXT,                            -- 本次运行 ID
  node_id    TEXT,                            -- 产生此消息的节点
  role       TEXT,                            -- 'user' (bot 发送) / 'assistant' (AI 回复)
  content    TEXT,                            -- 消息内容
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (flow_id) REFERENCES flows(id)
);
```

### scraped_data

网页抓取的数据。

```sql
CREATE TABLE scraped_data (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url  TEXT,                           -- 来源 URL
  title       TEXT,                           -- 标题
  content     TEXT,                           -- 内容摘要
  metadata    TEXT,                           -- 完整数据 JSON
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### projects

MiMo 产出的项目管理。

```sql
CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,                  -- 项目名称
  path        TEXT,                           -- 文件系统路径
  description TEXT,                           -- 描述
  flow_id     TEXT,                           -- 创建此项目的流程
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (flow_id) REFERENCES flows(id)
);
```

### settings

应用配置，Key-Value 存储。

```sql
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,                -- 配置键
  value      TEXT,                            -- 值（JSON 序列化）
  updated_at TEXT DEFAULT (datetime('now'))
);
```

settings 表中存储的配置项：

| key | 说明 | 示例值 |
|-----|------|--------|
| browser.url | MiMo URL | `"https://platform.xiaomimimo.com"` |
| browser.timeout | 超时 (ms) | `60000` |
| browser.slowMo | 慢速 (ms) | `500` |
| browser.adapter | 适配器名 | `"mimo"` |
| conversation.typingSpeed | 打字速度范围 | `[50, 150]` |
| conversation.delayBeforeSend | 发送前延迟 | `[1000, 3000]` |
| conversation.replyTimeout | 回复超时 (s) | `120` |
| github.token | GitHub Token | `"ghp_***"` |
| github.repo | 仓库名 | `"user/workspace"` |
| github.branch | 分支 | `"main"` |
| github.syncOnComplete | 完成后同步 | `true` |
| notification.onComplete | 完成通知 | `true` |
| notification.onFailure | 失败通知 | `true` |

### scrape_tasks

定时抓取任务。

```sql
CREATE TABLE scrape_tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,                   -- 任务名称
  url        TEXT NOT NULL,                   -- 目标 URL
  selector   TEXT,                            -- CSS 选择器
  frequency  TEXT DEFAULT 'daily',            -- 抓取频率
  enabled    INTEGER DEFAULT 1,               -- 是否启用
  last_run   TEXT,                            -- 上次运行时间
  created_at TEXT DEFAULT (datetime('now'))
);
```

## 查询安全

`database.query()` 方法有白名单限制，只允许查询预定义的表：

```javascript
const allowed = ['flows', 'variables', 'conversations', 'scraped_data', 'projects', 'scrape_tasks']
```

不在白名单内的表会抛出错误，防止 SQL 注入。

## 迁移

数据库使用 `CREATE TABLE IF NOT EXISTS`，启动时自动建表。版本升级时需手动处理 schema 变更：

```javascript
// 在 database.init() 中添加迁移逻辑
const version = db.getSetting('db_version') || 0

if (version < 2) {
  db._db.exec('ALTER TABLE flows ADD COLUMN tags TEXT')
  db.setSetting('db_version', 2)
}
```
