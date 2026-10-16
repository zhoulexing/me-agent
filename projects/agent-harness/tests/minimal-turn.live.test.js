import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../apps/cli/src/create-harness.js';

test('真实模型完成一次工具调用和最终回答', {
  skip: !existsSync(new URL('../.env', import.meta.url)) && !process.env.HARNESS_AUTH_TOKEN,
}, async () => {
  const harness = createHarness();
  const result = await harness.run('请调用 add 工具计算 17 加 25，然后只回答计算结果。', {
    requireTool: true,
  });
  assert.ok(result.events.some(event => event.type === 'tool.completed' && event.data.name === 'add'));
  assert.equal(result.events.at(-1)?.type, 'turn.completed');
  assert.match(result.finalText, /42/);
});

test('真实模型经过人工批准回调写入，再读取实际文件', {
  skip: process.platform !== 'darwin' || (!existsSync(new URL('../.env', import.meta.url)) && !process.env.HARNESS_AUTH_TOKEN),
  timeout: 90_000,
}, async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'harness-live-permissions-'));
  try {
    const harness = createHarness({ mode: 'ask', workspace });
    let approvals = 0;
    const result = await harness.run('请调用 write_file 在当前工作区写入 permission-live.txt，内容严格为 permission-ok；再调用 read_file 读取该文件，根据读取结果回答。', {
      requireTool: true,
      requestApproval(request) {
        approvals++;
        return request.name === 'write_file' && request.arguments.path.endsWith('/permission-live.txt')
          && request.arguments.content === 'permission-ok';
      },
    });
    assert.equal(approvals, 1);
    assert.equal(readFileSync(join(workspace, 'permission-live.txt'), 'utf8'), 'permission-ok');
    assert.ok(result.events.some(e => e.type === 'tool.completed' && e.data.name === 'read_file' && !e.data.isError));
    assert.match(result.finalText, /permission-ok/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('Anthropic Messages 真实模型支持工具调用和会话恢复', {
  skip: process.env.HARNESS_TEST_ANTHROPIC !== '1',
}, async () => {
  const harness = createHarness({ protocol: 'anthropic-messages' });
  const first = await harness.run('请调用 add 工具计算 17 加 25，然后只回答结果。', { requireTool: true });
  assert.match(first.finalText, /42/);
  const second = await harness.run('刚才的计算结果是多少？', { sessionId: first.sessionId });
  assert.equal(second.sessionId, first.sessionId);
  assert.match(second.finalText, /42/);
});
