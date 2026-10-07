import { LlmError, assertFinishEvent, toolCallsOf } from '@agent-harness/llm/contract';

export async function runStep({ model, session, tools, signal, onEvent, emit, step }) {
  await emit('step.started', { step });
  let finish;
  for await (const event of model.stream({
    systemPrompt: session.systemPrompt, messages: session.messages,
    tools: tools.schemas(), signal,
  })) {
    if (event.type === 'finish') {
      if (finish) throw new Error('模型流返回多个结束事件');
      finish = assertFinishEvent(event);
    } else if (!finish) onEvent?.(event);
    else throw new Error('模型流结束后仍返回内容');
  }
  signal?.throwIfAborted();
  if (!finish) throw new LlmError('模型流没有结束事件', 'STREAM_CLOSED');
  if (finish.reason === 'error' || finish.reason === 'aborted') {
    throw new LlmError(finish.failure?.message ?? '模型请求失败', finish.failure?.code ?? 'PROVIDER_ERROR');
  }
  if (finish.reason === 'max-tokens') throw new LlmError('模型达到最大输出长度', 'MAX_TOKENS');

  const calls = toolCallsOf(finish.message);
  if (finish.reason === 'tool-calls' && calls.length === 0) throw new Error('模型声明工具调用结束，但没有完整工具调用');
  await session.append(finish.message);
  await emit('model.responded', { step, finishReason: finish.reason, toolCalls: calls.length, usage: finish.usage });
  return { message: finish.message, calls };
}
