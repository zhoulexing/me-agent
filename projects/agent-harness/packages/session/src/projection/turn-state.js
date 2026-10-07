export function projectTurnState(events) {
  let turnOpen = false;
  let stepOpen = false;
  const pending = new Map();
  for (const event of events) {
    const { type, data } = event;
    if (type === 'turn.started') {
      turnOpen = true;
      stepOpen = false;
      pending.clear();
    } else if (type === 'turn.completed' || type === 'turn.failed'
      || type === 'turn.cancelled' || type === 'turn.interrupted') {
      turnOpen = false;
      stepOpen = false;
      // A cancelled turn can still have a tool whose outcome was never recorded.
    } else if (turnOpen && type === 'step.started') stepOpen = true;
    else if (turnOpen && ['step.completed', 'step.interrupted'].includes(type)) stepOpen = false;
    else if (type === 'message.appended' && data.message.role === 'tool') {
      pending.delete(data.message.callId);
    } else if (turnOpen && type === 'message.appended') {
      const message = data.message;
      if (message.role === 'assistant') {
        for (const call of message.content.filter(block => block.type === 'tool-call')) {
          pending.set(call.id, { call, started: false });
        }
      }
    } else if (turnOpen && type === 'tool.started') {
      const entry = pending.get(data.callId);
      if (entry) entry.started = true;
    }
  }
  return { turnOpen, stepOpen, pending: [...pending.values()] };
}
