const { contextBridge, ipcRenderer } = require('electron')

const api = {
  flow: {
    list: () => ipcRenderer.invoke('flow:list'),
    get: (id) => ipcRenderer.invoke('flow:get', id),
    save: (flow) => ipcRenderer.invoke('flow:save', flow),
    delete: (id) => ipcRenderer.invoke('flow:delete', id),
    duplicate: (id) => ipcRenderer.invoke('flow:duplicate', id),
    run: (id, inputVars) => ipcRenderer.invoke('flow:run', id, inputVars),
    pause: () => ipcRenderer.invoke('flow:pause'),
    resume: () => ipcRenderer.invoke('flow:resume'),
    stop: () => ipcRenderer.invoke('flow:stop'),
    getStatus: () => ipcRenderer.invoke('flow:getStatus'),
    getHistory: (flowId, opts) => ipcRenderer.invoke('flow:getHistory', flowId, opts),
  },
  variable: {
    list: () => ipcRenderer.invoke('variable:list'),
    get: (name) => ipcRenderer.invoke('variable:get', name),
    set: (name, value, scope) => ipcRenderer.invoke('variable:set', name, value, scope),
    delete: (name) => ipcRenderer.invoke('variable:delete', name),
    export: () => ipcRenderer.invoke('variable:export'),
    import: (vars) => ipcRenderer.invoke('variable:import', vars),
  },
  db: {
    getTables: () => ipcRenderer.invoke('db:getTables'),
    query: (table, filter) => ipcRenderer.invoke('db:query', table, filter),
    insert: (table, data) => ipcRenderer.invoke('db:insert', table, data),
    update: (table, id, data) => ipcRenderer.invoke('db:update', table, id, data),
    delete: (table, id) => ipcRenderer.invoke('db:delete', table, id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    getSection: (section) => ipcRenderer.invoke('settings:getSection', section),
    set: (section, values) => ipcRenderer.invoke('settings:set', section, values),
    reset: () => ipcRenderer.invoke('settings:reset'),
  },
  browser: {
    open: () => ipcRenderer.invoke('browser:open'),
    openUrl: (url) => ipcRenderer.invoke('browser:openUrl', url),
    screenshot: (opts) => ipcRenderer.invoke('browser:screenshot', opts),
    executeJs: (script) => ipcRenderer.invoke('browser:executeJs', script),
    saveCookie: () => ipcRenderer.invoke('browser:saveCookie'),
    loadCookie: () => ipcRenderer.invoke('browser:loadCookie'),
    clearCookie: () => ipcRenderer.invoke('browser:clearCookie'),
  },
  git: {
    sync: (opts) => ipcRenderer.invoke('git:sync', opts),
    status: () => ipcRenderer.invoke('git:status'),
    log: (opts) => ipcRenderer.invoke('git:log', opts),
  },
  scraper: {
    run: (config) => ipcRenderer.invoke('scraper:run', config),
    schedule: (name, config, cron) => ipcRenderer.invoke('scraper:schedule', name, config, cron),
    listTasks: () => ipcRenderer.invoke('scraper:listTasks'),
    deleteTask: (taskId) => ipcRenderer.invoke('scraper:deleteTask', taskId),
  },
  plugin: {
    list: () => ipcRenderer.invoke('plugin:list'),
    enable: (name) => ipcRenderer.invoke('plugin:enable', name),
    disable: (name) => ipcRenderer.invoke('plugin:disable', name),
    install: (dirPath) => ipcRenderer.invoke('plugin:install', dirPath),
    uninstall: (name) => ipcRenderer.invoke('plugin:uninstall', name),
  },
  schedule: {
    list: () => ipcRenderer.invoke('schedule:list'),
    add: (config) => ipcRenderer.invoke('schedule:add', config),
    update: (id, config) => ipcRenderer.invoke('schedule:update', id, config),
    delete: (id) => ipcRenderer.invoke('schedule:delete', id),
    runNow: (id) => ipcRenderer.invoke('schedule:runNow', id),
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    setChannel: (channel) => ipcRenderer.invoke('updater:setChannel', channel),
    onChecking: (cb) => ipcRenderer.on('updater:checking', (_, data) => cb(data)),
    onAvailable: (cb) => ipcRenderer.on('updater:available', (_, data) => cb(data)),
    onNotAvailable: (cb) => ipcRenderer.on('updater:not-available', (_, data) => cb(data)),
    onProgress: (cb) => ipcRenderer.on('updater:progress', (_, data) => cb(data)),
    onDownloaded: (cb) => ipcRenderer.on('updater:downloaded', (_, data) => cb(data)),
    onFallback: (cb) => ipcRenderer.on('updater:fallback', (_, data) => cb(data)),
    onError: (cb) => ipcRenderer.on('updater:error', (_, data) => cb(data)),
  },
  on: (event, callback) => {
    ipcRenderer.on(event, (_, data) => callback(data))
  },
  off: (event) => {
    ipcRenderer.removeAllListeners(event)
  },
}

contextBridge.exposeInMainWorld('api', api)
