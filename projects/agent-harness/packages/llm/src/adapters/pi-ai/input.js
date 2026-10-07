import { assertGenerateRequest } from '../../contract/request.js';
import { assertMessage, textOf } from '../../contract/message.js';
import { toPiAssistant } from './replay.js';

export function toPiContext(request) {
  assertGenerateRequest(request);
  return {
    systemPrompt: request.systemPrompt,
    tools: request.tools,
    messages: request.messages.map(message => {
      assertMessage(message);
      if (message.role === 'user') {
        if (message.content.some(block => block.type !== 'text')) throw new Error('当前 pi-ai 适配器只接收文本用户消息');
        return { role: 'user', content: textOf(message), timestamp: message.timestamp };
      }
      if (message.role === 'assistant') return toPiAssistant(message);
      if (message.content.some(block => block.type !== 'text')) throw new Error('当前 pi-ai 适配器只接收文本工具结果');
      return { role: 'toolResult', toolCallId: message.callId, toolName: message.name,
        content: message.content, isError: message.isError, timestamp: message.timestamp };
    }),
  };
}
