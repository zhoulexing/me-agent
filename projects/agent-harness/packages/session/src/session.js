import { assertMessage } from '@agent-harness/llm/contract';
import { createEvent } from './events/schema.js';
import { projectMessages } from './projection/messages.js';
import { repairInterruptedTurn } from './recovery/interrupted-turn.js';

export function createSession(handle, events) {
  return {
    id: handle.id,
    get events() { return events.slice(); },
    get systemPrompt() { return events[0]?.data.systemPrompt; },
    get messages() { return projectMessages(events); },
    async record(type, data = {}) {
      const event = createEvent(events.length + 1, type, data);
      await handle.append(event);
      await handle.flush();
      events.push(event);
      return event;
    },
    async append(message) {
      assertMessage(message);
      return this.record('message.appended', { message });
    },
    async repairInterrupted() { return repairInterruptedTurn(this); },
    async close() { await handle.close(); },
  };
}
