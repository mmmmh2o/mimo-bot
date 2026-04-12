function evaluateCondition(value, condition) {
  if (!condition) return false
  const { type, target } = condition
  switch (type) {
    case 'contains': return value.includes(target)
    case 'not-contains': return !value.includes(target)
    case 'equals': return value === target
    case 'regex': return new RegExp(target).test(value)
    case 'greater-than': return Number(value) > Number(target)
    case 'less-than': return Number(value) < Number(target)
    default: return false
  }
}

export default {
  async execute(data, ctx) {
    const sourceValue = ctx.variables.get(data.sourceVariable) || ''
    const result = evaluateCondition(sourceValue, data.condition)
    ctx.variables.set(`__branch_${data.id}`, result, 'runtime')
  }
}
