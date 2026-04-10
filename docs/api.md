# API 参考

MiMo Bot 通过 Electron IPC 在主进程和渲染进程之间通信。以下为完整的 IPC 接口列表。

## 流程管理

### `flow:list`

获取所有流程。

```
调用: window.api.invoke('flow:list')
返回: [{ id, name, description, updatedAt, nodeCount }, ...]
```

### `flow:get`

获取单个流程详情。

```
调用: window.api.invoke('flow:get', flowId)
参数: flowId (string)
返回: { id, name, nodes, edges, variables, adapter, ... }
```

### `flow:save`

保存流程（新建或更新）。

```
调用: window.api.invoke('flow:save', flow)
参数: flow { id?, name, nodes, edges, variables, adapter }
返回: { id, updatedAt }
```

### `flow:delete`

删除流程。

```
调用: window.api.invoke('flow:delete', flowId)
参数: flowId (string)
返回: { success: boolean }
```

### `flow:duplicate`

复制流程。

```
调用: window.api.invoke('flow:duplicate', flowId)
参数: flowId (string)
返回: { id }  // 新流程 ID
```

### `flow:run`

启动流程执行。

```
调用: window.api.invoke('flow:run', flowId)
参数: flowId (string), inputVariables? (object)
返回: { runId }
推送: flow:started → flow:node-started → ... → flow:completed
```

### `flow:pause`

暂停当前运行的流程。

```
调用: window.api.invoke('flow:pause')
推送: flow:paused
```

### `flow:resume`

恢复暂停的流程。

```
调用: window.api.invoke('flow:resume')
推送: flow:resumed
```

### `flow:stop`

终止当前运行的流程。

```
调用: window.api.invoke('flow:stop')
推送: flow:stopped
```

### `flow:getStatus`

获取当前运行状态。

```
调用: window.api.invoke('flow:getStatus')
返回: {
  running: boolean,
  paused: boolean,
  flowId: string,
  flowName: string,
  currentNodeId: string,
  step: number,
  totalSteps: number
}
```

### `flow:getHistory`

获取流程运行历史。

```
调用: window.api.invoke('flow:getHistory', flowId, { limit, offset })
返回: [{ runId, startedAt, completedAt, status, stepCount, duration }, ...]
```

---

## 变量管理

### `variable:get`

获取变量值。

```
调用: window.api.invoke('variable:get', name)
参数: name (string)
返回: { name, value, scope, type }
```

### `variable:set`

设置变量值。

```
调用: window.api.invoke('variable:set', name, value, scope)
参数: name (string), value (any), scope? ('input'|'runtime'|'output')
推送: flow:variable-updated
```

### `variable:list`

列出所有变量。

```
调用: window.api.invoke('variable:list')
返回: [{ name, value, scope, type }, ...]
```

### `variable:delete`

删除变量。

```
调用: window.api.invoke('variable:delete', name)
```

### `variable:export`

导出变量为 JSON。

```
调用: window.api.invoke('variable:export')
返回: { ...variables }
```

### `variable:import`

从 JSON 导入变量。

```
调用: window.api.invoke('variable:import', variables)
参数: variables (object)
```

---

## 数据库

### `db:getTables`

获取所有表。

```
调用: window.api.invoke('db:getTables')
返回: ['flows', 'variables', 'conversations', 'scraped_data', ...]
```

### `db:query`

查询表数据。

```
调用: window.api.invoke('db:query', table, { filter, orderBy, limit, offset })
返回: { rows, total }
```

### `db:insert`

插入记录。

```
调用: window.api.invoke('db:insert', table, data)
返回: { id }
```

### `db:update`

更新记录。

```
调用: window.api.invoke('db:update', table, id, data)
返回: { success }
```

### `db:delete`

删除记录。

```
调用: window.api.invoke('db:delete', table, id)
返回: { success }
```

### `db:export`

导出表为 CSV。

```
调用: window.api.invoke('db:export', table, filePath)
返回: { path }
```

### `db:import`

从 CSV 导入数据。

```
调用: window.api.invoke('db:import', table, filePath)
返回: { count }
```

---

## 浏览器控制

### `browser:openUrl`

在内置浏览器中打开 URL。

```
调用: window.api.invoke('browser:openUrl', url)
参数: url (string)
推送: browser:url-changed
```

### `browser:screenshot`

截取当前页面截图。

```
调用: window.api.invoke('browser:screenshot', { fullPage, selector })
返回: { dataUrl }
```

### `browser:executeJs`

在页面中执行 JavaScript。

```
调用: window.api.invoke('browser:executeJs', script)
参数: script (string)
返回: any
```

### `browser:getCookies`

获取当前页面 Cookies。

```
调用: window.api.invoke('browser:getCookies')
返回: [{ name, value, domain, ... }, ...]
```

### `browser:saveCookies`

保存 Cookies 到本地。

```
调用: window.api.invoke('browser:saveCookies')
返回: { success, savedAt }
```

### `browser:loadCookies`

从本地加载 Cookies。

```
调用: window.api.invoke('browser:loadCookies')
返回: { success }
```

---

## 网页抓取

### `scraper:run`

执行单次抓取任务。

```
调用: window.api.invoke('scraper:run', config)
参数: config {
  url: string,
  method: 'css' | 'xpath' | 'full-text',
  selector: string,
  extract: { field: selector },
  saveToDb: boolean
}
返回: { data, savedCount }
```

### `scraper:schedule`

创建定时抓取任务。

```
调用: window.api.invoke('scraper:schedule', name, config, cron)
参数: name (string), config (object), cron (string)
返回: { taskId }
```

### `scraper:listTasks`

列出所有抓取任务。

```
调用: window.api.invoke('scraper:listTasks')
返回: [{ id, name, url, cron, lastRun, status }, ...]
```

### `scraper:deleteTask`

删除抓取任务。

```
调用: window.api.invoke('scraper:deleteTask', taskId)
```

---

## Git 同步

### `git:status`

获取 Git 状态。

```
调用: window.api.invoke('git:status')
返回: { branch, modified, staged, untracked, lastCommit }
```

### `git:sync`

执行 commit + push。

```
调用: window.api.invoke('git:sync', { message? })
返回: { commit, pushed }
```

### `git:pull`

拉取远程更新。

```
调用: window.api.invoke('git:pull')
返回: { success, conflicts }
```

### `git:log`

获取提交历史。

```
调用: window.api.invoke('git:log', { limit })
返回: [{ hash, message, date, author }, ...]
```

---

## 设置

### `settings:get`

获取全部设置。

```
调用: window.api.invoke('settings:get')
返回: { browser, conversation, github, notification, schedule, ... }
```

### `settings:getSection`

获取指定分类设置。

```
调用: window.api.invoke('settings:getSection', section)
参数: section: 'browser' | 'conversation' | 'github' | 'notification' | 'schedule'
返回: object
```

### `settings:set`

更新设置。

```
调用: window.api.invoke('settings:set', section, values)
参数: section (string), values (object)
返回: { success }
```

### `settings:reset`

重置为默认值。

```
调用: window.api.invoke('settings:reset', section?)
返回: { success }
```

---

## 插件管理

### `plugin:list`

列出已安装插件。

```
调用: window.api.invoke('plugin:list')
返回: [{ name, version, type, description, enabled }, ...]
```

### `plugin:enable` / `plugin:disable`

启用/禁用插件。

```
调用: window.api.invoke('plugin:enable', name)
调用: window.api.invoke('plugin:disable', name)
```

### `plugin:install`

从本地目录安装插件。

```
调用: window.api.invoke('plugin:install', dirPath)
返回: { success, name }
```

### `plugin:uninstall`

卸载插件。

```
调用: window.api.invoke('plugin:uninstall', name)
```

---

## 调度

### `schedule:list`

列出定时任务。

```
调用: window.api.invoke('schedule:list')
返回: [{ id, flowId, flowName, cron, enabled, nextRun }, ...]
```

### `schedule:add`

添加定时任务。

```
调用: window.api.invoke('schedule:add', { flowId, cron, enabled })
返回: { id }
```

### `schedule:update`

更新定时任务。

```
调用: window.api.invoke('schedule:update', id, { cron?, enabled? })
```

### `schedule:delete`

删除定时任务。

```
调用: window.api.invoke('schedule:delete', id)
```

### `schedule:runNow`

立即执行一次。

```
调用: window.api.invoke('schedule:runNow', id)
```

---

## 事件推送 (Main → Renderer)

通过 `window.api.on(event, callback)` 订阅事件：

| 事件 | 数据 | 说明 |
|------|------|------|
| `flow:started` | `{ flowId, name, totalSteps }` | 流程开始 |
| `flow:paused` | `{}` | 流程暂停 |
| `flow:resumed` | `{}` | 流程恢复 |
| `flow:stopped` | `{}` | 流程终止 |
| `flow:node-started` | `{ nodeId, nodeType, step, total }` | 节点开始 |
| `flow:node-completed` | `{ nodeId, step, total }` | 节点完成 |
| `flow:node-error` | `{ nodeId, error }` | 节点出错 |
| `flow:variable-updated` | `{ name, value }` | 变量更新 |
| `flow:waiting-input` | `{ nodeId, message }` | 等待人工介入 |
| `flow:completed` | `{ flowId, variables }` | 流程完成 |
| `flow:error` | `{ error }` | 流程出错 |
| `browser:url-changed` | `{ url }` | 页面 URL 变化 |
| `browser:screenshot-update` | `{ dataUrl }` | 截图更新 |
| `log:new` | `{ level, message, timestamp }` | 新日志 |
| `schedule:triggered` | `{ taskId, flowId }` | 定时触发 |
| `scraper:completed` | `{ taskId, count }` | 抓取完成 |
| `git:synced` | `{ commit, pushed }` | Git 同步完成 |
