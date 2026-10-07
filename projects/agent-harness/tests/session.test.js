import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSessionStore } from '../packages/session/src/index.js';

test('恢复时区分未知结果和未启动工具，并修复不完整末行', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'agent-harness-session-'));
  try {
    const store = createSessionStore({ directory });
    const session = await store.create({ systemPrompt: 'test' });
    const id = session.id;
    await session.record('turn.started');
    await session.record('step.started', { step: 1 });
    await session.append({ role: 'assistant', content: [
      { type: 'tool-call', id: 'call-1', name: 'write', arguments: { value: 1 } },
      { type: 'tool-call', id: 'call-2', name: 'write', arguments: { value: 2 } },
    ] });
    await session.record('tool.started', { callId: 'call-1', name: 'write' });
    await session.close();
    appendFileSync(join(directory, `${id}.jsonl`), '{"type":"tool.completed"');

    const resumed = await store.open(id);
    await resumed.repairInterrupted();
    await resumed.repairInterrupted();
    assert.equal(resumed.messages.filter(message => message.role === 'tool').length, 2);
    assert.equal(resumed.messages.at(-1).isError, true);
    assert.equal(resumed.events.filter(event => event.type === 'tool.result_unknown').length, 1);
    assert.equal(resumed.events.filter(event => event.type === 'tool.not_started').length, 1);
    assert.equal(resumed.events.filter(event => event.type === 'step.interrupted').length, 1);
    assert.equal(resumed.events.filter(event => event.type === 'turn.interrupted').length, 1);
    await resumed.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('已取消轮次的未决工具在恢复时只补一次未知结果', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'agent-harness-session-'));
  try {
    const store = createSessionStore({ directory });
    const session = await store.create({ systemPrompt: 'test' });
    const id = session.id;
    await session.record('turn.started');
    await session.record('step.started', { step: 1 });
    await session.append({ role: 'assistant', content: [
      { type: 'tool-call', id: 'call-3', name: 'write', arguments: {} },
    ] });
    await session.record('tool.started', { callId: 'call-3', name: 'write' });
    await session.record('turn.cancelled');
    await assert.rejects(store.open(id), /已有写入者/);
    await session.close();

    const resumed = await store.open(id);
    await resumed.repairInterrupted();
    await resumed.repairInterrupted();
    assert.equal(resumed.messages.filter(message => message.role === 'tool').length, 1);
    assert.equal(resumed.events.filter(event => event.type === 'tool.result_unknown').length, 1);
    assert.equal(resumed.events.filter(event => event.type === 'turn.interrupted').length, 0);
    await resumed.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
