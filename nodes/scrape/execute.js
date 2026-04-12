export default {
  async execute(data, ctx) {
    await ctx.browser.ensureReady()
    const url = ctx.render(data.url)
    const selector = ctx.render(data.selector)
    const page = ctx.browser.getPage()

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    if (selector) {
      await page.waitForSelector(selector, { timeout: 10000 })
      const elements = await page.$$(selector)
      const texts = []
      for (const el of elements) {
        texts.push(await el.textContent())
      }
      if (data.outputVariable) {
        ctx.variables.set(data.outputVariable, texts, 'runtime')
      }
    } else {
      const content = await page.content()
      if (data.outputVariable) {
        ctx.variables.set(data.outputVariable, content, 'runtime')
      }
    }
  }
}
