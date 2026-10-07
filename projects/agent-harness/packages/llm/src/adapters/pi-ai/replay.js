import { assertMessage } from '../../contract/message.js';

export function fromPiAssistant(raw) {
  const content = raw.content.map(block => {
    if (block.type === 'text') return { type: 'text', text: block.text };
    if (block.type === 'thinking') return { type: 'reasoning', text: block.thinking };
    if (block.type === 'toolCall') return { type: 'tool-call', id: block.id, name: block.name, arguments: block.arguments };
    throw new Error(`不支持的 pi-ai 内容块：${block.type}`);
  });
  return assertMessage({ role: 'assistant', content, timestamp: raw.timestamp,
    model: { provider: raw.provider, id: raw.model, api: raw.api },
    usage: raw.usage,
    replay: { adapter: 'pi-ai', version: 1, raw },
  });
}

export function toPiAssistant(message) {
  if (message.replay?.adapter === 'pi-ai' && message.replay.version === 1) return message.replay.raw;
  if (!message.model) throw new Error('历史 assistant 消息缺少模型信息');
  return {
    role: 'assistant',
    content: message.content.map(block => {
      if (block.type === 'text') return { type: 'text', text: block.text };
      if (block.type === 'reasoning') return { type: 'thinking', thinking: block.text };
      if (block.type === 'tool-call') return { type: 'toolCall', id: block.id, name: block.name, arguments: block.arguments };
      throw new Error(`不支持的历史内容块：${block.type}`);
    }),
    api: message.model.api, provider: message.model.provider, model: message.model.id,
    usage: message.usage, stopReason: 'stop', timestamp: message.timestamp,
  };
}
