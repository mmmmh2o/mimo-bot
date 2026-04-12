export default {
  async execute(data, ctx) {
    const fs = await import('fs/promises')
    const path = await import('path')
    const value = ctx.variables.get(data.variable) || ''
    const filePath = ctx.render(data.path)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    if (data.append) {
      await fs.appendFile(filePath, value, 'utf-8')
    } else {
      await fs.writeFile(filePath, value, 'utf-8')
    }
  }
}
