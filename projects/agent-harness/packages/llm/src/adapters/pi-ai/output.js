import { providerFailure } from '../../contract/error.js';
import { fromPiAssistant } from './replay.js';

const reasons = { stop: 'stop', toolUse: 'tool-calls', length: 'max-tokens' };

export function fromPiEvent(event) {
  switch (event.type) {
    case 'text_delta': return { type: 'text.delta', text: event.delta };
    case 'toolcall_delta': return { type: 'tool-call.delta', argumentsDelta: event.delta, index: event.contentIndex };
    case 'toolcall_end': return { type: 'tool-call.ready', call: {
      id: event.toolCall.id, name: event.toolCall.name, arguments: event.toolCall.arguments,
    } };
    case 'done': {
      const reason = reasons[event.reason];
      if (!reason) return { type: 'finish', reason: 'error', failure: {
        code: 'UNSUPPORTED_FINISH', message: `不支持的模型结束原因：${event.reason}`,
      } };
      return { type: 'finish', reason, message: fromPiAssistant(event.message), usage: event.message.usage };
    }
    case 'error': return { type: 'finish', reason: event.reason === 'aborted' ? 'aborted' : 'error',
      failure: event.reason === 'aborted'
        ? { code: 'ABORTED', message: event.error.errorMessage ?? '模型请求已取消' }
        : providerFailure(event.error.errorMessage ?? '模型请求失败') };
    default: return undefined;
  }
}
