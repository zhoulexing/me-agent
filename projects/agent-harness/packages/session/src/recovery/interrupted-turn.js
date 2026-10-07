import { createToolResultMessage } from '@agent-harness/llm/contract';
import { projectTurnState } from '../projection/turn-state.js';

export async function repairInterruptedTurn(session) {
  const state = projectTurnState(session.events);
  if (!state.turnOpen && state.pending.length === 0) return false;
  for (const { call, started } of state.pending) {
    await session.append(createToolResultMessage({ callId: call.id, name: call.name,
      result: started
        ? '上次执行被中断；工具结果未知。若有外部副作用，先核对目标状态，不要直接重试。'
        : '上次执行被中断；工具尚未开始，未执行。',
      isError: true }));
    await session.record(started ? 'tool.result_unknown' : 'tool.not_started', { callId: call.id, name: call.name });
  }
  if (state.stepOpen) await session.record('step.interrupted');
  if (state.turnOpen) await session.record('turn.interrupted');
  return true;
}
