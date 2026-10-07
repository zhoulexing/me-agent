import { createJsonlBackend } from './persistence/jsonl.js';
import { createStore } from './persistence/store.js';

export function createSessionStore({ directory }) {
  return createStore(createJsonlBackend({ directory }));
}
