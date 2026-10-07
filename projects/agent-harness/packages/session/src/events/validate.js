import { assertMessage } from '@agent-harness/llm/contract';
import { EVENT_TYPES, SESSION_FORMAT_VERSION } from './schema.js';

export function validateLog(events) {
  if (!Array.isArray(events) || events.length === 0) throw new Error('会话日志为空');
  for (const [index, event] of events.entries()) {
    if (event?.seq !== index + 1 || !EVENT_TYPES.has(event.type)
      || typeof event.at !== 'string' || !event.data || typeof event.data !== 'object') {
      throw new Error(`会话日志事件 ${index + 1} 无效`);
    }
    if (event.type === 'message.appended') assertMessage(event.data.message);
  }
  const header = events[0];
  if (header.type !== 'session.created' || header.data.formatVersion !== SESSION_FORMAT_VERSION
    || typeof header.data.systemPrompt !== 'string') throw new Error('会话格式不受支持');
  return events;
}
