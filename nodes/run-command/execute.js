export default {
  async execute(data, ctx) {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const command = ctx.render(data.command)
    const cwd = data.workingDir ? ctx.render(data.workingDir) : process.cwd()
    const timeout = (data.timeout || 60) * 1000

    const { stdout, stderr } = await execAsync(command, { cwd, timeout })
    const output = stdout || stderr

    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, output, 'runtime')
    }
  }
}
