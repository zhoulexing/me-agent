import { mock } from 'claude-code/testing';
import type { On } from 'claude-code';
export function host(on: On) {
  let project = '';
  const writes = new Map<string, string>();
  const state = new Map<string, unknown>();
  let changed = false;
  let linked = false;
  let failRead = false;
  const clock = mock.clock(on);
  mock.store(on);
  on('fs.stat', ($, e) => {
    if (e.path.endsWith('/plugins/research-notebook')) project = e.path.slice(0, -'/plugins/research-notebook'.length);
    const isFixture = /F[123]-/.test(e.path);
    return { value: { realPath: linked && isFixture ? '/private/secret' : e.path, kind: isFixture ? 'file' : 'dir', size: 200, mtimeMs: 1, isLink: linked && isFixture } };
  });
  on('session.cwd', () => ({ value: project + '/workspace' }));
  on('fs.read', ($, e) => {
    if (failRead) throw new Error('secret-api-error-body');
    const id = e.path.match(/F[123]/)?.[0] ?? 'F1';
    return { value: '# 合成教学资料\n[' + id + '-E1] 流程证据\n[' + id + '-E2] 反例\n' + (changed ? '[' + id + '-E3] 新资料' : '') };
  });
  on('fs.exists', () => ({ value: false }));
  on('fs.write', ($, e) => { writes.set(e.path.split('/').pop()!, e.text); return { value: undefined }; });
  on('state.get', ($, e) => ({ value: { value: state.get(e.key), version: 0 } }));
  on('state.set', ($, e) => { state.set(e.key, e.value); return { value: { isSet: true, version: 1 } }; });
  on('tool.register', ($, e) => ({ value: { tool: 'mcp__research-notebook__' + e.name } }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('agent.register', ($, e) => ({ value: { agent: 'research-notebook:' + e.name } }));
  on('ui.log', () => ({ value: undefined }));
  on('ui.status', () => ({ value: undefined }));
  on('ui.invalidate', () => ({ value: undefined }));
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('session.end', () => ({sessionId:'test-session'}));
  on('turn.start', ($, e) => ({ turnId: e.turnId }));
  on('turn.complete', ($, e) => ({ text: e.answer }));
  on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }));
  return { writes, state, clock, change: () => { changed = true; }, link: () => { linked = true; }, fail: () => { failRead = true; } };
}
