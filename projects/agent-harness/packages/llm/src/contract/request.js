/**
 * Model adapter boundary. `stream(request)` yields zero or more deltas and
 * exactly one terminal `finish` event. Adapters make one provider attempt;
 * retry policy belongs above this boundary.
 * @typedef {{stream(request: GenerateRequest): AsyncIterable<import('./stream-event.js').LlmStreamEvent>}} LlmAdapter
 * @typedef {{systemPrompt: string, messages: Array<object>, tools?: Array<object>, signal?: AbortSignal}} GenerateRequest
 */

export function assertGenerateRequest(request) {
  if (!request || !Array.isArray(request.messages) || typeof request.systemPrompt !== 'string') {
    throw new Error('模型请求缺少 systemPrompt 或 messages');
  }
  if (request.tools !== undefined && !Array.isArray(request.tools)) throw new Error('模型工具定义必须是数组');
  request.signal?.throwIfAborted();
  return request;
}
