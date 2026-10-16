import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPermissionController, createLocalTools, createToolRegistry } from '../../packages/core/src/index.js';

// No model or credentials required. Real tools and real OS enforcement.
const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-permissions-demo-')));
const workspace = join(root, 'workspace'); mkdirSync(workspace);
let seq = 0;
function registry(mode) {
  const permissions = createPermissionController({ mode, workspace });
  return createToolRegistry(createLocalTools(permissions.config), { permissions });
}
async function call(tools, name, args, requestApproval) {
  return tools.execute({ id: `demo-${++seq}`, name, arguments: args }, { requestApproval,
    emit: async (type, data) => {
      if (type === 'permission.decided') console.log(`  ${data.source}: ${data.decision} — ${data.reason}`);
      if (type === 'permission.requested') console.log(`  请求批准 ${data.name}（此时尚未执行）`);
    },
  });
}
try {
  console.log('1. ask：没有批准通道，写入被拒绝');
  await assert.rejects(call(registry('ask'), 'write_file', { path: 'unapproved.txt', content: 'no' }), /批准通道/);
  assert.equal(existsSync(join(workspace, 'unapproved.txt')), false);

  console.log('\n2. ask：测试宿主批准这一次写入');
  await call(registry('ask'), 'write_file', { path: 'approved.txt', content: 'yes' }, () => true);
  assert.equal(readFileSync(join(workspace, 'approved.txt'), 'utf8'), 'yes');

  console.log('\n3. read-only：脚本试图通过 Node 写文件，OS 拒绝');
  writeFileSync(join(workspace, 'writer.cjs'), 'require("fs").writeFileSync("bypass.txt", "no")');
  await assert.rejects(call(registry('read-only'), 'exec', { command: process.execPath, args: ['writer.cjs'] }), /EPERM|EACCES/);
  assert.equal(existsSync(join(workspace, 'bypass.txt')), false);

  console.log('\n4. workspace：生成代码再运行，区内写入成功，区外写入失败');
  const outside = join(root, 'outside.txt');
  const code = `require('fs').writeFileSync('inside.txt','yes');require('fs').writeFileSync(${JSON.stringify(outside)},'no');`;
  const tools = registry('workspace');
  await call(tools, 'write_file', { path: 'generated.cjs', content: code });
  await assert.rejects(call(tools, 'exec', { command: process.execPath, args: ['generated.cjs'] }), /EPERM|EACCES/);
  assert.equal(readFileSync(join(workspace, 'inside.txt'), 'utf8'), 'yes');
  assert.equal(existsSync(outside), false);

  console.log('\n5. auto：规则审核通过结构化写入，任意代码转交人工');
  await call(registry('auto'), 'write_file', { path: 'auto.txt', content: 'yes' });
  await assert.rejects(call(registry('auto'), 'exec', { command: process.execPath, args: ['-e', 'console.log(1)'] }), /批准通道/);

  console.log('\n6. full-access：显式关闭沙箱后，允许写到测试工作区之外');
  await call(registry('full-access'), 'write_file', { path: outside, content: 'explicit permission' });
  assert.equal(readFileSync(outside, 'utf8'), 'explicit permission');
  console.log('\n全部 6 个实验通过。限制发生在真实工具与操作系统，不依赖模型配合。');
} finally { rmSync(root, { recursive: true, force: true }); }
