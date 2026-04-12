export default {
  async execute(data, ctx) {
    const items = ctx.variables.get(data.sourceVariable) || []
    if (!Array.isArray(items)) return
    const max = data.maxIterations || items.length
    for (let i = 0; i < Math.min(items.length, max); i++) {
      ctx.variables.set(data.itemVariable || 'item', items[i], 'runtime')
      ctx.variables.set(data.indexVariable || 'index', i, 'runtime')
    }
  }
}
