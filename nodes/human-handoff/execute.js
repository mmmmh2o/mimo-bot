export default {
  async execute(data, ctx) {
    ctx.emit('flow:waiting-input', {
      message: data.message || '需要人工介入',
    })
    while (true) {
      await new Promise(r => setTimeout(r, 500))
      if (!this._paused) break
    }
  }
}
