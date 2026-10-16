import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, linkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createPermissionController, createLocalTools, createToolRegistry, runTurn } from '../packages/core/src/index.js';
import { createSandboxExecutor } from '../packages/core/src/permissions/sandbox.js';
import { createSessionStore } from '../packages/session/src/index.js';

const hasSandbox = process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec');
function fixture(t, mode = 'workspace', options = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-permissions-')));
  const workspace = join(root, 'workspace');
  mkdirSync(workspace);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const permissions = createPermissionController({ mode, workspace, ...options });
  const tools = createToolRegistry(createLocalTools(permissions.config), { permissions });
  const events = [];
  let seq = 0;
  const call = (name, args, context = {}) => tools.execute({ id: `call-${++seq}`, name, arguments: args }, {
    emit: async (type, data) => events.push({ type, data }), ...context,
  });
  const exec = (source, context) => call('exec', { command: process.execPath, args: ['-e', source] }, context);
  return { root, workspace, permissions, tools, events, call, exec };
}

test('未知元数据、未知参数和无效模式拒绝执行；模式不由模型提供', async t => {
  const { permissions } = fixture(t);
  let ran = false;
  const tools = createToolRegistry([{ name: 'unclassified', parameters: { properties: {} }, execute() { ran = true; } }], { permissions });
  await assert.rejects(tools.execute({ id: 'a', name: 'unclassified', arguments: {} }), /权限元数据/);
  await assert.rejects(tools.execute({ id: 'b', name: 'unclassified', arguments: { sandbox: 'none' } }), /未声明参数/);
  assert.equal(ran, false);
  assert.throws(() => createPermissionController({ mode: 'typo' }), /未知权限/);
});

test('ask 在用户明确批准前没有副作用；一次批准不缓存', { skip: !hasSandbox }, async t => {
  const f = fixture(t, 'ask');
  let approve, requested;
  const ready = new Promise(resolve => { requested = resolve; });
  const pending = f.call('write_file', { path: 'ok.txt', content: 'approved' }, {
    requestApproval: request => { assert.equal(request.action.effect, 'write'); requested(); return new Promise(resolve => { approve = resolve; }); },
  });
  await ready;
  assert.equal(existsSync(join(f.workspace, 'ok.txt')), false);
  approve(true);
  await pending;
  assert.equal(readFileSync(join(f.workspace, 'ok.txt'), 'utf8'), 'approved');
  await assert.rejects(f.call('write_file', { path: 'ok.txt', content: 'unapproved' }), /批准通道/);
  assert.equal(readFileSync(join(f.workspace, 'ok.txt'), 'utf8'), 'approved');
  assert.equal(f.events.filter(e => e.type === 'permission.requested').length, 2);
});

test('批准等待期间冻结参数；取消会立即返回，迟到的同意无效', async t => {
  const f = fixture(t, 'ask');
  const abort = new AbortController();
  let late;
  const pending = f.call('write_file', { path: 'no.txt', content: 'no' }, {
    signal: abort.signal,
    requestApproval(request) {
      assert.throws(() => { request.arguments.content = 'tampered'; }, TypeError);
      queueMicrotask(() => abort.abort(new Error('cancelled')));
      return new Promise(resolve => { late = resolve; });
    },
  });
  await assert.rejects(pending, /cancelled/);
  late(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(existsSync(join(f.workspace, 'no.txt')), false);
});

test('auto 规则审核只批准受限结构化写；任意代码需要人工，审核异常拒绝', { skip: !hasSandbox }, async t => {
  const f = fixture(t, 'auto');
  await f.call('write_file', { path: 'auto.txt', content: 'yes' });
  assert.ok(f.events.some(e => e.data.source === 'reviewer' && e.data.decision === 'allow'));
  await assert.rejects(f.exec('console.log(1)'), /批准通道/);
  const broken = fixture(t, 'auto', { review() { throw new Error('broken'); } });
  await assert.rejects(broken.call('write_file', { path: 'no.txt', content: 'no' }), /审核器失败/);
});

test('read-only 同时拦截显式写、解释器写、shell 重定向和孙进程写', { skip: !hasSandbox }, async t => {
  const f = fixture(t, 'read-only');
  writeFileSync(join(f.workspace, 'existing.txt'), 'original');
  await assert.rejects(f.call('write_file', { path: 'existing.txt', content: 'bad' }), /只读/);
  await assert.rejects(f.exec('require("fs").writeFileSync("existing.txt", "bad")'), /EPERM|EACCES|Operation not permitted/);
  await assert.rejects(f.call('exec', { command: '/bin/sh', args: ['-c', 'echo bad > existing.txt'] }), /permitted|denied/i);
  await assert.rejects(f.exec('require("child_process").execFileSync(process.execPath,["-e",\'require("fs").writeFileSync("existing.txt","bad")\'])'), /EPERM|EACCES|permitted/);
  assert.equal(readFileSync(join(f.workspace, 'existing.txt'), 'utf8'), 'original');
  assert.equal((await f.call('read_file', { path: 'existing.txt' })).result.content, 'original');
});

test('生成代码再执行：工作区内写入成功，工作区外写入被 OS 拒绝', { skip: !hasSandbox }, async t => {
  const f = fixture(t);
  const outside = join(f.root, 'outside.txt');
  await f.call('write_file', { path: 'generated.cjs', content:
    `require('fs').writeFileSync('inside.txt', 'allowed'); require('fs').writeFileSync(${JSON.stringify(outside)}, 'blocked');` });
  await assert.rejects(f.call('exec', { command: process.execPath, args: ['generated.cjs'] }), /EPERM|EACCES/);
  assert.equal(readFileSync(join(f.workspace, 'inside.txt'), 'utf8'), 'allowed');
  assert.equal(existsSync(outside), false);
});

test('人工批准 exec 后仍无法越界；不同工具路径都受限', { skip: !hasSandbox }, async t => {
  const f = fixture(t, 'ask');
  let asks = 0;
  const ctx = { requestApproval() { asks++; return true; } };
  await assert.rejects(f.call('write_file', { path: '../outside.txt', content: 'no' }, ctx), /工作区之外/);
  assert.equal(asks, 0);
  await assert.rejects(f.exec(`require('fs').writeFileSync(${JSON.stringify(join(f.root, 'outside.txt'))}, 'no')`, ctx), /EPERM|EACCES/);
  assert.equal(asks, 1);
  assert.equal(existsSync(join(f.root, 'outside.txt')), false);
});

test('符号链接、相邻前缀目录与批准后路径替换不能绕过写范围', { skip: !hasSandbox }, async t => {
  const f = fixture(t, 'ask');
  const outside = join(f.root, 'workspace-other'); mkdirSync(outside);
  symlinkSync(outside, join(f.workspace, 'escape'));
  await assert.rejects(f.call('write_file', { path: 'escape/no.txt', content: 'no' }), /工作区之外/);
  mkdirSync(join(f.workspace, 'mutable'));
  await assert.rejects(f.call('write_file', { path: 'mutable/no.txt', content: 'no' }, { requestApproval() {
    rmSync(join(f.workspace, 'mutable'), { recursive: true }); symlinkSync(outside, join(f.workspace, 'mutable')); return true;
  } }), /EPERM|EACCES/);
  assert.equal(existsSync(join(outside, 'no.txt')), false);
});

test('凭据、控制路径、宿主令牌与工作区外私有文件不可经 exec 读取或修改', { skip: !hasSandbox }, async t => {
  const f = fixture(t);
  writeFileSync(join(f.workspace, '.env'), 'fake-secret');
  mkdirSync(join(f.workspace, '.git'));
  writeFileSync(join(f.root, 'private.txt'), 'outside-secret');
  await assert.rejects(f.call('read_file', { path: '.env' }), /凭据文件/);
  await assert.rejects(f.exec('console.log(require("fs").readFileSync(".env","utf8"))'), /EPERM|EACCES/);
  await assert.rejects(f.exec('require("fs").writeFileSync(".git/config","bad")'), /EPERM|EACCES/);
  await assert.rejects(f.exec(`console.log(require('fs').readFileSync(${JSON.stringify(join(f.root, 'private.txt'))}, 'utf8'))`), /EPERM|EACCES/);
  process.env.HARNESS_TEST_FAKE_SECRET = 'must-not-inherit';
  try { assert.equal((await f.exec('console.log(process.env.HARNESS_TEST_FAKE_SECRET ?? "absent")')).result.stdout.trim(), 'absent'); }
  finally { delete process.env.HARNESS_TEST_FAKE_SECRET; }
});

test('网络在 OS 层阻断，使用本地监听器验证无连接', { skip: !hasSandbox }, async t => {
  const f = fixture(t);
  let connections = 0;
  const server = createServer(socket => { connections++; socket.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(f.exec(`const s=require('net').connect(${server.address().port},'127.0.0.1'); s.on('error',e=>{console.error(e.code);process.exit(1)});s.on('connect',()=>s.end());`), /EPERM|EACCES/);
    assert.equal(connections, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('不能先重命名保护目录的父目录，再修改权限实现', { skip: !hasSandbox }, async t => {
  const f = fixture(t);
  const parent = join(f.workspace, 'parent');
  const control = join(parent, 'control');
  mkdirSync(control, { recursive: true }); writeFileSync(join(control, 'policy.js'), 'original');
  const permissions = createPermissionController({ mode: 'workspace', workspace: f.workspace, protectedPaths: [control] });
  const tools = createToolRegistry(createLocalTools(permissions.config), { permissions });
  await assert.rejects(tools.execute({ id: 'rename', name: 'exec', arguments: { command: process.execPath, args: ['-e',
    'const fs=require("fs");fs.renameSync("parent","moved");fs.writeFileSync("moved/control/policy.js","bad");fs.renameSync("moved","parent");'] } }), /EPERM|EACCES/);
  assert.equal(readFileSync(join(control, 'policy.js'), 'utf8'), 'original');
});

test('full-access 与 never 有区别：none 可在临时目录越界写入', async t => {
  const f = fixture(t, 'full-access');
  await f.call('write_file', { path: '../allowed.txt', content: 'explicit-full-access' });
  assert.equal(readFileSync(join(f.root, 'allowed.txt'), 'utf8'), 'explicit-full-access');
  assert.equal(f.events.filter(e => e.type === 'permission.requested').length, 0);
});

test('结构化写拒绝已有硬链接，保护链接指向的原始内容', { skip: !hasSandbox }, async t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'original.txt'), 'original');
  linkSync(join(f.root, 'original.txt'), join(f.workspace, 'hardlink.txt'));
  await assert.rejects(f.call('write_file', { path: 'hardlink.txt', content: 'bad' }), /硬链接|EPERM|EACCES/);
  await assert.rejects(f.exec('require("fs").writeFileSync("hardlink.txt","bad")'), /硬链接/);
  assert.equal(readFileSync(join(f.root, 'original.txt'), 'utf8'), 'original');
});

test('执行超时与主动取消都终止运行', { skip: !hasSandbox }, async t => {
  const f = fixture(t);
  const execute = createSandboxExecutor(f.permissions.config, { timeoutMs: 100 });
  await assert.rejects(execute(process.execPath, ['-e', 'setInterval(()=>{},1000)']), /超时/);
  const abort = new AbortController();
  const running = execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: abort.signal });
  setTimeout(() => abort.abort(new Error('stop')), 30);
  await assert.rejects(running, /stop/);
});

function scriptedModel(call) {
  let step = 0;
  return { async *stream() {
    yield step++ === 0
      ? { type: 'finish', reason: 'tool-calls', message: { role: 'assistant', content: [{ type: 'tool-call', ...call }] } }
      : { type: 'finish', reason: 'stop', message: { role: 'assistant', content: [{ type: 'text', text: '完成测试轮次' }] } };
  } };
}

test('真实运行循环持久化批准再开始；拒绝返回模型错误，恢复时不复用批准', { skip: !hasSandbox }, async t => {
  const f = fixture(t, 'ask');
  const store = createSessionStore({ directory: join(f.root, 'sessions') });
  let session = await store.create({ systemPrompt: 'test' });
  const id = session.id;
  const call = { id: 'w1', name: 'write_file', arguments: { path: 'ok.txt', content: 'ok' } };
  await runTurn({ model: scriptedModel(call), tools: f.tools, session, userInput: '写入', requestApproval: () => true });
  const types = session.events.map(e => e.type);
  assert.ok(types.indexOf('permission.decided') < types.indexOf('tool.started'));
  await session.close();
  session = await store.open(id);
  try {
    await runTurn({ model: scriptedModel({ ...call, id: 'w2', arguments: { path: 'no.txt', content: 'no' } }),
      tools: f.tools, session, userInput: '未批准' });
    assert.equal(existsSync(join(f.workspace, 'no.txt')), false);
    assert.equal(session.events.some(e => e.type === 'tool.started' && e.data.callId === 'w2'), false);
    assert.equal(session.messages.filter(m => m.role === 'tool').at(-1).isError, true);
  } finally { await session.close(); }
});

test('批准等待中断的日志恢复为未启动，不会报为结果未知', async t => {
  const f = fixture(t, 'ask');
  const store = createSessionStore({ directory: join(f.root, 'sessions') });
  const session = await store.create({ systemPrompt: 'test' });
  const id = session.id;
  const abort = new AbortController();
  await assert.rejects(runTurn({ tools: f.tools, session, userInput: 'write', signal: abort.signal,
    model: scriptedModel({ id: 'pending', name: 'write_file', arguments: { path: 'no.txt', content: 'no' } }),
    requestApproval() { abort.abort(new Error('cancel')); return false; },
  }), /cancel/);
  await session.close();
  const resumed = await store.open(id);
  try {
    await resumed.repairInterrupted();
    assert.ok(resumed.events.some(e => e.type === 'tool.not_started'));
    assert.equal(resumed.events.some(e => e.type === 'tool.result_unknown'), false);
  } finally { await resumed.close(); }
});
