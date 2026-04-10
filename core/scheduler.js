/**
 * 定时调度器
 * 基于 node-cron 实现流程定时执行
 */
import cron from 'node-cron'
import log from 'electron-log'

export class Scheduler {
  constructor(flowEngine) {
    this.flowEngine = flowEngine
    this._tasks = new Map() // jobId -> { task, config }
  }

  /**
   * 添加定时任务
   * @param {object} config
   * @param {string} config.id - 任务 ID
   * @param {string} config.flowId - 流程 ID
   * @param {string} config.frequency - 频率 (daily|hourly|weekly|cron)
   * @param {string} config.time - 时间 (HH:mm)
   * @param {string} config.cron - cron 表达式 (frequency=cron 时使用)
   * @param {boolean} config.enabled - 是否启用
   */
  add(config) {
    const { id, flowId, frequency, time, cron: cronExpr, enabled = true } = config

    // 移除已存在的同 ID 任务
    this.remove(id)

    if (!enabled) {
      log.info(`定时任务 ${id} 已禁用，跳过注册`)
      return
    }

    const expression = this._getCronExpression(frequency, time, cronExpr)
    if (!cron.validate(expression)) {
      throw new Error(`无效的 cron 表达式: ${expression}`)
    }

    const task = cron.schedule(expression, async () => {
      log.info(`定时任务 ${id} 触发，执行流程 ${flowId}`)
      try {
        await this.flowEngine.run(flowId)
      } catch (error) {
        log.error(`定时任务 ${id} 执行失败`, error)
      }
    }, {
      timezone: 'Asia/Shanghai',
    })

    this._tasks.set(id, { task, config })
    log.info(`定时任务已注册: ${id} (${expression})`)
  }

  /**
   * 移除定时任务
   */
  remove(id) {
    const existing = this._tasks.get(id)
    if (existing) {
      existing.task.stop()
      this._tasks.delete(id)
    }
  }

  /**
   * 获取所有任务状态
   */
  list() {
    return Array.from(this._tasks.entries()).map(([id, { config }]) => ({
      id,
      ...config,
    }))
  }

  /**
   * 停止所有任务
   */
  stopAll() {
    for (const [id, { task }] of this._tasks) {
      task.stop()
      log.info(`定时任务已停止: ${id}`)
    }
    this._tasks.clear()
  }

  _getCronExpression(frequency, time, cronExpr) {
    if (frequency === 'cron' && cronExpr) {
      return cronExpr
    }

    const [hour, minute] = (time || '09:00').split(':')

    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`
      case 'hourly':
        return `0 * * * *`
      case 'weekly':
        return `${minute} ${hour} * * 1` // 每周一
      default:
        return `${minute} ${hour} * * *`
    }
  }
}
