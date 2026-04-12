async function executeCustomSend(data, ctx, content) {
  const inputSel = ctx.render(data.inputSelector)
  const sendMethod = data.sendMethod || 'click'
  const sendSel = data.sendSelector ? ctx.render(data.sendSelector) : null
  const inputMethod = data.inputMethod || 'type'

  if (!inputSel) throw new Error('自定义模式：未配置输入目标选择器')

  if (inputMethod === 'fill') {
    await ctx.browser.fill(inputSel, content)
  } else {
    await ctx.browser.type(inputSel, content, {
      typingSpeed: data.typingSpeed || [50, 150],
    })
  }

  const delayRange = data.delayBeforeSend || [500, 1500]
  const delay = Array.isArray(delayRange)
    ? delayRange[0] + Math.random() * (delayRange[1] - delayRange[0])
    : delayRange
  await new Promise(r => setTimeout(r, delay))

  if (sendMethod === 'click' && sendSel) {
    await ctx.browser.click(sendSel)
  } else if (sendMethod === 'enter') {
    await ctx.browser.pressEnter(inputSel)
  } else if (sendMethod === 'both' && sendSel) {
    await ctx.browser.pressEnter(inputSel)
    await new Promise(r => setTimeout(r, 300))
    await ctx.browser.click(sendSel)
  }

  if (data.waitForReply && data.replySelector) {
    const replySel = ctx.render(data.replySelector)
    const reply = await ctx.browser.waitForAndGetText(replySel, {
      timeout: data.timeout || 120,
    })
    if (data.outputVariable) {
      ctx.variables.set(data.outputVariable, reply, 'runtime')
    }
    ctx.db?.insert('conversations', {
      flow_id: ctx.variables.get('__flow_id'),
      node_id: data.id,
      role: 'user',
      content,
    })
    ctx.db?.insert('conversations', {
      flow_id: ctx.variables.get('__flow_id'),
      node_id: data.id,
      role: 'assistant',
      content: reply,
    })
  }
}

export default {
  async execute(data, ctx) {
    const content = ctx.render(data.content)

    if (data.mode === 'custom') {
      await executeCustomSend(data, ctx, content)
    } else {
      await ctx.browser.sendMessage(content, {
        typingSpeed: data.typingSpeed || [50, 150],
        delayBeforeSend: data.delayBeforeSend || [1000, 3000],
      })

      if (data.waitForReply) {
        const reply = await ctx.browser.waitForReply({
          timeout: data.timeout || 120,
        })
        if (data.outputVariable) {
          ctx.variables.set(data.outputVariable, reply, 'runtime')
        }
        ctx.db?.insert('conversations', {
          flow_id: ctx.variables.get('__flow_id'),
          node_id: data.id,
          role: 'user',
          content,
        })
        ctx.db?.insert('conversations', {
          flow_id: ctx.variables.get('__flow_id'),
          node_id: data.id,
          role: 'assistant',
          content: reply,
        })
      }
    }
  }
}
