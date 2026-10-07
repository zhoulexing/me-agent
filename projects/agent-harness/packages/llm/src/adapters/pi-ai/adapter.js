import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { assertFinishEvent } from '../../contract/stream-event.js';
import { providerFailure } from '../../contract/error.js';
import { createPiModel } from './model-profile.js';
import { toPiContext } from './input.js';
import { fromPiEvent } from './output.js';

const apiFactories = {
  'openai-completions': openAICompletionsApi,
  'anthropic-messages': anthropicMessagesApi,
};

export function createPiAiAdapter(profile) {
  if (!profile.authToken) throw new Error('缺少模型网关凭证');
  const descriptor = createPiModel(profile);
  const api = apiFactories[descriptor.api]();
  const timeoutMs = profile.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs 必须是正整数');

  return {
    profile: { protocol: descriptor.api, provider: descriptor.provider, model: descriptor.id },
    async *stream(request) {
      const context = toPiContext(request);
      const deadline = AbortSignal.timeout(timeoutMs);
      const signal = request.signal
        ? AbortSignal.any([request.signal, deadline])
        : deadline;
      let terminal = false;
      try {
        const source = api.stream(descriptor, context, {
          apiKey: profile.authToken, signal, timeoutMs, maxTokens: descriptor.maxTokens, maxRetries: 0,
        });
        for await (const raw of source) {
          if (terminal) throw new Error('模型流结束后仍返回事件');
          let event = fromPiEvent(raw);
          if (!event) continue;
          if (event.type === 'finish' && event.reason === 'aborted' && deadline.aborted && !request.signal?.aborted) {
            event = { type: 'finish', reason: 'error', failure: { code: 'TIMEOUT', message: '模型请求超时' } };
          }
          if (event.type === 'finish') {
            if (terminal) throw new Error('模型流返回多个结束事件');
            terminal = true;
            yield assertFinishEvent(event);
          } else if (!terminal) yield event;
        }
      } catch (error) {
        if (terminal) throw error;
        terminal = true;
        yield { type: 'finish', reason: request.signal?.aborted ? 'aborted' : 'error',
          failure: request.signal?.aborted ? { code: 'ABORTED', message: '模型请求已取消' }
            : deadline.aborted ? { code: 'TIMEOUT', message: '模型请求超时' } : providerFailure(error.message) };
      }
      if (!terminal) yield { type: 'finish', reason: request.signal?.aborted ? 'aborted' : 'error',
        failure: { code: request.signal?.aborted ? 'ABORTED' : deadline.aborted ? 'TIMEOUT' : 'STREAM_CLOSED',
          message: '模型流未正常结束' } };
    },
  };
}
