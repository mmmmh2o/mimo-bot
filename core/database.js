/**
 * 数据库模块
 * SQLite 存储：流程、变量、对话记录、抓取数据
 */
import DatabaseConstructor from 'better-sqlite3'
import log from 'electron-log'

export class Database {
  constructor(dbPath) {
    this.dbPath = dbPath
    this._db = null
  }

  async init() {
    this._db = new DatabaseConstructor(this.dbPath)
    this._db.pragma('journal_mode = WAL')
    this._db.pragma('foreign_keys = ON')

    // 创建表
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS variables (
        name TEXT PRIMARY KEY,
        value TEXT,
        type TEXT DEFAULT 'string',
        scope TEXT DEFAULT 'persistent',
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flow_id TEXT,
        run_id TEXT,
        node_id TEXT,
        role TEXT,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (flow_id) REFERENCES flows(id)
      );

      CREATE TABLE IF NOT EXISTS scraped_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_url TEXT,
        title TEXT,
        content TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT,
        description TEXT,
        flow_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (flow_id) REFERENCES flows(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS scrape_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        selector TEXT,
        frequency TEXT DEFAULT 'daily',
        enabled INTEGER DEFAULT 1,
        last_run TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)

    log.info(`数据库已初始化: ${this.dbPath}`)
  }

  // ---- 流程 CRUD ----

  getFlows() {
    const rows = this._db.prepare('SELECT * FROM flows ORDER BY updated_at DESC').all()
    return rows.map(r => ({ ...r, data: JSON.parse(r.data) }))
  }

  getFlow(id) {
    const row = this._db.prepare('SELECT * FROM flows WHERE id = ?').get(id)
    if (!row) return null
    return { ...row, data: JSON.parse(row.data), ...JSON.parse(row.data) }
  }

  saveFlow(flow) {
    const { id, name, description, ...rest } = flow
    const data = JSON.stringify(rest)
    this._db.prepare(`
      INSERT INTO flows (id, name, description, data, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        data = excluded.data,
        updated_at = datetime('now')
    `).run(id, name || '未命名', description || '', data)
  }

  deleteFlow(id) {
    this._db.prepare('DELETE FROM flows WHERE id = ?').run(id)
  }

  // ---- 变量 CRUD ----

  getVariables() {
    return this._db.prepare('SELECT * FROM variables ORDER BY name').all()
  }

  getVariable(name) {
    const row = this._db.prepare('SELECT * FROM variables WHERE name = ?').get(name)
    return row ? row.value : null
  }

  setVariable(name, value, scope = 'persistent', type = 'string') {
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    this._db.prepare(`
      INSERT INTO variables (name, value, type, scope, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(name) DO UPDATE SET
        value = excluded.value,
        type = excluded.type,
        scope = excluded.scope,
        updated_at = datetime('now')
    `).run(name, val, type, scope)
  }

  deleteVariable(name) {
    this._db.prepare('DELETE FROM variables WHERE name = ?').run(name)
  }

  // ---- 通用表操作 ----

  getTables() {
    const rows = this._db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all()
    return rows.map(r => r.name)
  }

  query(table, filter = {}) {
    // 安全校验：只允许查询已知表
    const allowed = ['flows', 'variables', 'conversations', 'scraped_data', 'projects', 'scrape_tasks']
    if (!allowed.includes(table)) {
      throw new Error(`不允许查询表: ${table}`)
    }
    return this._db.prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 100`).all()
  }

  insert(table, data) {
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => {
      const v = data[k]
      return typeof v === 'object' ? JSON.stringify(v) : v
    })
    this._db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values)
  }

  update(table, id, data) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v)
    this._db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...values, id)
  }

  deleteRecord(table, id) {
    this._db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
  }

  // ---- 设置 ----

  getSetting(key) {
    const row = this._db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? JSON.parse(row.value) : null
  }

  setSetting(key, value) {
    this._db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(key, JSON.stringify(value))
  }

  close() {
    if (this._db) {
      this._db.close()
      this._db = null
    }
  }
}
