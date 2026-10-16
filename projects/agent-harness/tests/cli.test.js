import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../apps/cli/src/args.js';
import { createHumanRenderer } from '../apps/cli/src/render.js';
import { EventEmitter } from 'node:events';
import { createLineReader, terminalApprover } from '../apps/cli/src/approval.js';
import { createJsonRenderer } from '../apps/cli/src/render-json.js';
import { runSingle } from '../apps/cli/src/single.js';

test('resume 无问题进入交互模式，有问题保持单次运行', () => {
  assert.deepEqual(parseArgs(['resume', 'session-1']).mode, 'interactive');
  assert.deepEqual(parseArgs(['resume', 'session-1', '继续']).mode, 'single');
  assert.deepEqual(parseArgs([]).mode, 'interactive');
  assert.throws(() => parseArgs(['run', '--json']), /需要单次运行/);
});

test('权限预设与两个独立覆盖项正确解析，拼写错误不能回退到宽松模式', () => {
  assert.deepEqual(parseArgs(['run', '--mode', 'ask', '--workspace', '/tmp/demo', '--sandbox', 'read-only', '--approval', 'always', 'test']).permissions,
    { mode: 'ask', workspace: '/tmp/demo', sandbox: 'read-only', approval: 'always' });
  assert.throws(() => parseArgs(['--mode', 'typo']), /无效/);
  assert.throws(() => parseArgs(['--sandbox', 'none', '--sandbox', 'none']), /重复/);
  assert.throws(() => parseArgs(['--workspace']), /无效/);
});

test('批准输入不复用已排队文字、不成为下一轮问题，取消不吞下一条输入', async () => {
  const rl = new EventEmitter();
  const reader = createLineReader(rl);
  rl.emit('line', 'y');
  const output = { write() {} };
  const approve = terminalApprover({ reader, output, enabled: true });
  const request = { requestId: 'id', name: 'exec', arguments: {}, config: { sandbox: 'read-only', workspace: '/tmp', network: 'deny' } };
  let settled = false;
  const result = approve(request).then(value => { settled = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  rl.emit('line', 'y');
  assert.equal(await result, true);
  const abort = new AbortController();
  const cancelled = approve(request, { signal: abort.signal });
  abort.abort(new Error('cancelled'));
  await assert.rejects(cancelled, /cancelled/);
  rl.emit('line', 'next question');
  assert.equal(await reader.next(), 'next question');
  const eof = approve(request); rl.emit('close');
  assert.equal(await eof, false);
  assert.equal(terminalApprover({ reader, output, enabled: false }), undefined);
});

test('JSON 与非交互运行不从 stdin 接受批准，批准事件仍可观察', async () => {
  let text = '';
  const output = { write(value) { text += value; } };
  const harness = { async run(_prompt, options) {
    assert.equal(options.requestApproval, undefined);
    options.onEvent({ type: 'permission.decided', data: { decision: 'deny' } });
    return { sessionId: 'test', finalText: 'denied' };
  } };
  assert.equal(await runSingle({ harness, prompt: 'test', json: true, input: { isTTY: false }, output }), 0);
  assert.equal(JSON.parse(text.split('\n')[0]).type, 'permission.decided');
  const renderer = createJsonRenderer(output);
  renderer.onEvent({ type: 'permission.requested', data: { requestId: 'id' } });
  assert.match(text, /permission.requested/);
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
