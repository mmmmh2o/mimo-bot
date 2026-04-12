export default {
  async execute(data, ctx) {
    let reply
    if (data.mode === 'custom' && data.replySelector) {
      const sel = ctx.render(data.replySelector)
      reply = await ctx.browser.waitForAndGetText(sel, {
        timeout: data.timeout || 120,
      })
    } else {
      reply = await ctx.browser.waitForReply({
        timeout: data.timeout || 120,
      })
    }
    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, reply, 'runtime')
    }
  }
}
