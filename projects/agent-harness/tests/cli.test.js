import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../apps/cli/src/args.js';
import { createHumanRenderer } from '../apps/cli/src/render.js';

test('resume 无问题进入交互模式，有问题保持单次运行', () => {
  assert.deepEqual(parseArgs(['resume', 'session-1']).mode, 'interactive');
  assert.deepEqual(parseArgs(['resume', 'session-1', '继续']).mode, 'single');
  assert.deepEqual(parseArgs([]).mode, 'interactive');
  assert.throws(() => parseArgs(['run', '--json']), /需要单次运行/);
});

test('交互输出展示工具参数与结果，同一会话不重复提示 ID', () => {
  let text = '';
  const sink = { write(chunk) { text += chunk; } };
  const renderer = createHumanRenderer({ output: sink, diagnostics: sink, interactive: true,
    initialSessionId: 'session-1' });
  renderer.onEvent({ type: 'turn.started', data: { sessionId: 'session-1' } });
  renderer.onEvent({ type: 'tool.started', data: { name: 'add', arguments: { a: 3, b: 4 } } });
  renderer.onEvent({ type: 'message.appended', data: { message: { role: 'tool', name: 'add',
    content: [{ type: 'text', text: '{"sum":7}' }], isError: false } } });
  renderer.onEvent({ type: 'text.delta', text: '7' });
  renderer.finish('7');
  assert.match(text, /\[工具\] add \{"a":3,"b":4\}/);
  assert.match(text, /\[工具结果\] add: \{"sum":7\}/);
  assert.match(text, /助手> 7/);
  assert.doesNotMatch(text, /会话：session-1/);
});
