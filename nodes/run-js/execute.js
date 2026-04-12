export default {
  async execute(data, ctx) {
    const code = data.code || ''
    if (!code.trim()) throw new Error('run-js: 未配置代码，请在节点配置中填写 JavaScript 代码')

    // 变量插值
    let script = ctx.render(code)

    try {
      if (data.selector) {
        // 有选择器：在选中元素的上下文执行，脚本中可用 el 变量
        const sel = ctx.render(data.selector)
        if (data.waitForElement) {
          await ctx.browser.waitForSelector(sel, { timeout: (data.timeout || 30) * 1000 })
        }
        const result = await ctx.browser.executeJs(`
          (function() {
            var el = document.querySelector(${JSON.stringify(sel)});
            if (!el) throw new Error('选择器未命中元素: ${sel.replace(/'/g, "\\'")}');
            ${script}
          })()
        `)
        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, result, 'runtime')
          ctx.emit('flow:variable-updated', { name: data.outputVariable, value: result })
        }
      } else {
        // 无选择器：在页面全局上下文执行
        const result = await ctx.browser.executeJs(script)
        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, result, 'runtime')
          ctx.emit('flow:variable-updated', { name: data.outputVariable, value: result })
        }
      }
    } catch (error) {
      throw new Error(`run-js 执行失败: ${error.message}`)
    }
  }
}
