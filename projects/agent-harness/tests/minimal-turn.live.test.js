import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
