/**
 * 网页抓取引擎
 * 从网页提取数据，存入数据库或变量
 */
import log from 'electron-log'

export class Scraper {
  constructor(browserController) {
    this.browser = browserController
  }

  /**
   * 执行抓取任务
   * @param {object} config
   * @param {string} config.url - 目标 URL
   * @param {string} config.selector - CSS 选择器
   * @param {object} config.extract - 提取字段映射 { fieldName: cssSelector }
   * @param {string} config.outputVariable - 输出变量名
   * @param {boolean} config.saveToDb - 是否存入数据库
   * @returns {Promise<Array>} 提取的数据
   */
  async run(config) {
    const { url, selector, extract, outputVariable, saveToDb } = config

    log.info(`开始抓取: ${url}`)

    // 打开新标签页
    const page = await this.browser._context.newPage()

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })

      let results = []

      if (selector) {
        // 列表模式：选择多个元素
        const elements = page.locator(selector)
        const count = await elements.count()

        for (let i = 0; i < count; i++) {
          const item = elements.nth(i)
          const data = {}

          if (extract) {
            for (const [field, fieldSelector] of Object.entries(extract)) {
              try {
                const el = item.locator(fieldSelector)
                data[field] = await el.innerText().catch(() => '')
              } catch {
                data[field] = ''
              }
            }
          } else {
            data.content = await item.innerText().catch(() => '')
          }

          data.url = url
          data.scrapedAt = new Date().toISOString()
          results.push(data)
        }
      } else {
        // 全页模式
        const data = {
          url,
          title: await page.title(),
          content: await page.locator('body').innerText(),
          scrapedAt: new Date().toISOString(),
        }
        results.push(data)
      }

      log.info(`抓取完成: ${results.length} 条数据`)

      // 存入数据库
      if (saveToDb && results.length > 0) {
        const db = this.browser._db
        if (db) {
          for (const item of results) {
            db.insert('scraped_data', {
              source_url: item.url,
              title: item.title || '',
              content: item.content || JSON.stringify(item),
              metadata: JSON.stringify(item),
            })
          }
          log.info(`${results.length} 条数据已存入数据库`)
        }
      }

      return results

    } finally {
      await page.close()
    }
  }
}
