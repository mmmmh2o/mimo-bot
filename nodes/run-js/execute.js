export default {
  async execute(data, ctx) {
    let script = ctx.render(data.code || '')
    if (!script) throw new Error('run-js: 未配置代码')

    if (data.selector) {
      const sel = ctx.render(data.selector)
      if (data.waitForElement) {
        await ctx.browser.waitForSelector(sel, { timeout: (data.timeout || 30) * 1000 })
      }
      const page = ctx.browser.getPage()
      const result = await page.evaluate(
        ({ sel, script }) => {
          const el = document.querySelector(sel)
          return eval(script)
        },
        { sel, script }
      )
      if (data.outputVariable) {
        ctx.variables.set(data.outputVariable, result, 'runtime')
        ctx.emit('flow:variable-updated', { name: data.outputVariable, value: result })
      }
    } else {
      const result = await ctx.browser.executeJs(script)
      if (data.outputVariable) {
        ctx.variables.set(data.outputVariable, result, 'runtime')
        ctx.emit('flow:variable-updated', { name: data.outputVariable, value: result })
      }
    }
  }
}
