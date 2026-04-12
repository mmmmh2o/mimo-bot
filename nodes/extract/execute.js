export default {
  async execute(data, ctx) {
    const source = ctx.variables.get(data.sourceVariable) || ''
    if (!data.rules) return

    for (const rule of data.rules) {
      let extracted = null
      if (rule.type === 'regex') {
        const match = source.match(new RegExp(rule.pattern, 's'))
        extracted = match ? match[1] || match[0] : null
      } else if (rule.type === 'code-block') {
        const lang = rule.language || '\\w+'
        const re = new RegExp('\`\`\`' + lang + '\\n([\\s\\S]*?)\`\`\`', 's')
        const match = source.match(re)
        extracted = match ? match[1] : null
      }
      if (extracted !== null) {
        ctx.variables.set(rule.variable, extracted, rule.dataType || 'string')
        ctx.emit('flow:variable-updated', { name: rule.variable, value: extracted })
      }
    }
  }
}
