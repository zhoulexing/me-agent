import { createSession } from '../session.js';
import { SESSION_FORMAT_VERSION } from '../events/schema.js';
import { validateLog } from '../events/validate.js';

// A backend supplies create/open handles with read, append, flush and close.
export function createStore(backend) {
  return {
    async create({ systemPrompt }) {
      if (typeof systemPrompt !== 'string') throw new Error('systemPrompt 必须是字符串');
      const handle = await backend.create();
      const session = createSession(handle, []);
      try {
        await session.record('session.created', { formatVersion: SESSION_FORMAT_VERSION, systemPrompt });
        return session;
      } catch (error) {
        await session.close();
        throw error;
      }
    },
    async open(id) {
      const handle = await backend.open(id);
      try {
        const events = validateLog(await handle.read());
        return createSession(handle, events);
      } catch (error) {
        await handle.close();
        throw error;
      }
    },
  };
}
