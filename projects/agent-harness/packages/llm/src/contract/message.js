const contentTypes = new Set(['text', 'reasoning', 'tool-call']);

export function createUserMessage(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('用户输入不能为空');
  return { role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() };
}

export function createToolResultMessage({ callId, name, result, isError = false }) {
  if (!callId || !name) throw new Error('工具结果缺少调用标识');
  return { role: 'tool', callId, name,
    content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
    isError, timestamp: Date.now() };
}

export function textOf(message) {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join('');
}

export function toolCallsOf(message) {
  return message.content.filter(block => block.type === 'tool-call');
}

export function assertMessage(message) {
  if (!message || !['user', 'assistant', 'tool'].includes(message.role) || !Array.isArray(message.content)) {
    throw new Error('无效的统一消息');
  }
  for (const block of message.content) {
    if (!block || (message.role === 'assistant' ? !contentTypes.has(block.type) : block.type !== 'text')) {
      throw new Error(`不支持的消息内容块：${block?.type}`);
    }
    if (block.type === 'text' && typeof block.text !== 'string') throw new Error('文本内容块缺少 text');
    if (block.type === 'reasoning' && typeof block.text !== 'string') throw new Error('推理内容块缺少 text');
    if (block.type === 'tool-call' && (!block.id || !block.name || typeof block.arguments !== 'object'
      || block.arguments === null || Array.isArray(block.arguments))) {
      throw new Error('无效的工具调用内容块');
    }
  }
  if (message.role === 'tool' && (!message.callId || !message.name)) throw new Error('无效的工具结果消息');
  return message;
}
