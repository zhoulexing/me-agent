import { createUserMessage, textOf } from '@agent-harness/llm/contract';
import { runStep } from './run-step.js';
import { executeToolCalls, skipToolCalls } from './execute-tools.js';

export async function runTurn({ model, session, tools, userInput, maxSteps = 4, requireTool = false, signal, onEvent }) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new Error('maxSteps 必须是正整数');
  signal?.throwIfAborted();
  const emit = async (type, data = {}) => {
    const event = await session.record(type, data);
    onEvent?.(event);
    return event;
  };
  await session.append(createUserMessage(userInput));
  await emit('turn.started', { sessionId: session.id });

  try {
    for (let step = 1; step <= maxSteps; step += 1) {
      signal?.throwIfAborted();
      const { message, calls } = await runStep({ model, session, tools, signal, onEvent, emit, step });
      if (step === 1 && requireTool && calls.length === 0) throw new Error('首个模型响应没有调用工具');
      if (calls.length === 0) {
        const finalText = textOf(message);
        if (!finalText.trim()) throw new Error('模型没有返回可展示的最终回答');
        await emit('step.completed', { step });
        await emit('turn.completed', { step });
        return { sessionId: session.id, finalText, events: session.events, messages: session.messages };
      }
      if (step === maxSteps) {
        await skipToolCalls({ calls, session, emit, onEvent, step });
        throw new Error(`超过最大模型调用步数 ${maxSteps}`);
      }
      await executeToolCalls({ calls, session, tools, signal, emit, onEvent, step });
      await emit('step.completed', { step });
    }
    throw new Error(`超过最大模型调用步数 ${maxSteps}`);
  } catch (error) {
    await emit(signal?.aborted || error.code === 'ABORTED' ? 'turn.cancelled' : 'turn.failed', { reason: error.message });
    throw error;
  }
}
