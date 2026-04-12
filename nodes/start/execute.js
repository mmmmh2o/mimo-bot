export default {
  async execute(data, ctx) {
    if (data.inputVariables) {
      for (const [k, v] of Object.entries(data.inputVariables)) {
        ctx.variables.set(k, ctx.render(v), 'input')
      }
    }
  }
}
