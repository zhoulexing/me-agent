export const SESSION_FORMAT_VERSION = 2;

export const EVENT_TYPES = new Set([
  'session.created', 'message.appended',
  'turn.started', 'turn.completed', 'turn.failed', 'turn.cancelled', 'turn.interrupted',
  'step.started', 'step.completed', 'step.interrupted', 'model.responded',
  'tool.started', 'tool.completed', 'tool.skipped', 'tool.result_unknown', 'tool.not_started',
  'permission.configured', 'permission.requested', 'permission.reviewed', 'permission.decided',
]);

export function createEvent(seq, type, data = {}) {
  if (!EVENT_TYPES.has(type)) throw new Error(`未知会话事件：${type}`);
  return { seq, at: new Date().toISOString(), type, data };
}
