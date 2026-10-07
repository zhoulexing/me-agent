/**
 * @typedef {{type: 'text.delta', text: string}
 *   | {type: 'tool-call.delta', argumentsDelta: string, index: number}
 *   | {type: 'tool-call.ready', call: object}
 *   | {type: 'finish', reason: 'stop'|'tool-calls'|'max-tokens'|'aborted'|'error',
 *      message?: object, usage?: object, failure?: {code: string, message: string}}} LlmStreamEvent
 */

export const FINISH_REASONS = Object.freeze(['stop', 'tool-calls', 'max-tokens', 'aborted', 'error']);

export function isTerminalEvent(event) {
  return event?.type === 'finish';
}

export function assertFinishEvent(event) {
  if (!isTerminalEvent(event) || !FINISH_REASONS.includes(event.reason)) {
    throw new Error('模型流没有合法的结束事件');
  }
  if (['stop', 'tool-calls', 'max-tokens'].includes(event.reason) && !event.message) {
    throw new Error('模型结束事件缺少完整消息');
  }
  return event;
}
