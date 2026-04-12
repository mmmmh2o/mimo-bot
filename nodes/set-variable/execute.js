export default {
  async execute(data, ctx) {
    ctx.variables.set(data.name, ctx.render(data.value), data.scope || 'runtime')
    ctx.emit('flow:variable-updated', { name: data.name, value: data.value })
  }
}
