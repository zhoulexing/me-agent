import { createToolResultMessage } from '@agent-harness/llm/contract';

export async function skipToolCalls({ calls, session, emit, onEvent, step }) {
  for (const call of calls) {
    const recorded = await session.append(createToolResultMessage({ callId: call.id, name: call.name,
      result: '达到最大模型调用步数，工具未执行。', isError: true }));
    onEvent?.(recorded);
    await emit('tool.skipped', { step, callId: call.id, name: call.name, reason: 'max_steps' });
  }
}

export async function executeToolCalls({ calls, session, tools, signal, emit, onEvent, step }) {
  for (const call of calls) {
    signal?.throwIfAborted();
    // Durable call intent precedes any possible tool side effect.
    await emit('tool.started', { step, callId: call.id, name: call.name, arguments: call.arguments });
    let result;
    let isError = false;
    try {
      result = (await tools.execute(call, { signal })).result;
    } catch (error) {
      if (signal?.aborted) throw error;
      result = { error: error.message };
      isError = true;
    }
    const recorded = await session.append(createToolResultMessage({ callId: call.id, name: call.name, result, isError }));
    onEvent?.(recorded);
    await emit('tool.completed', { step, callId: call.id, name: call.name, isError });
  }
}
