export default {
  async execute(data, ctx) {
    const fs = await import('fs/promises')
    const filePath = ctx.render(data.path)
    const content = await fs.readFile(filePath, data.encoding || 'utf-8')
    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, content, 'runtime')
    }
  }
}
