import { createToolResultMessage } from '@agent-harness/llm/contract';

export async function skipToolCalls({ calls, session, emit, onEvent, step }) {
  for (const call of calls) {
    const recorded = await session.append(createToolResultMessage({ callId: call.id, name: call.name,
      result: '达到最大模型调用步数，工具未执行。', isError: true }));
    onEvent?.(recorded);
    await emit('tool.skipped', { step, callId: call.id, name: call.name, reason: 'max_steps' });
  }
}

export async function executeToolCalls({ calls, session, tools, signal, emit, onEvent, step, requestApproval }) {
  for (const call of calls) {
    signal?.throwIfAborted();
    let result;
    let isError = false;
    try {
      result = (await tools.execute(call, { signal, emit, requestApproval,
        // Approval is not execution: only record started after the gate opens.
        beforeExecute: prepared => emit('tool.started', { step, callId: prepared.id,
          name: prepared.name, arguments: prepared.arguments }),
      })).result;
    } catch (error) {
      if (signal?.aborted) throw error;
      result = { error: error.message, code: error.code ?? 'TOOL_ERROR' };
      isError = true;
    }
    const recorded = await session.append(createToolResultMessage({ callId: call.id, name: call.name, result, isError }));
    onEvent?.(recorded);
    await emit('tool.completed', { step, callId: call.id, name: call.name, isError });
  }
}
