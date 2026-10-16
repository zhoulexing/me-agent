import { MODES, SANDBOXES, APPROVALS } from '@agent-harness/core';

export const usage = `用法：
  agent-harness                         开始交互会话
  agent-harness run [问题]              有问题时单次运行；不传则交互
  agent-harness resume <session-id> [问题]  恢复会话；不传问题则交互
  agent-harness chat                    开始交互会话

选项：--protocol openai-completions|anthropic-messages  --json（单次运行）
      --mode default|ask|auto|workspace|read-only|full-access
      --workspace <已有目录>（默认当前目录）
      --sandbox read-only|workspace-write|none
      --approval on-request|always|auto|never
权限：mode 提供预设；sandbox / approval 可独立覆盖。never 表示不询问，不会关闭沙箱。
      受限执行当前支持 macOS；沙箱不可用时拒绝执行。批准仅限本次调用，不扩大范围。
交互命令：/id  /history  /new  /help  /exit
配置读取工程根目录的 .env。\n`;

export function parseArgs(argv) {
  const args = [...argv];
  if (args.includes('--help') || args.includes('-h')) return { mode: 'help' };
  let protocol;
  let json = false;
  const permissions = {};
  for (let i = 0; i < args.length;) {
    if (args[i] === '--protocol') {
      protocol = args[i + 1];
      if (!['openai-completions', 'anthropic-messages'].includes(protocol)) {
        throw new Error('--protocol 需要 openai-completions 或 anthropic-messages');
      }
      args.splice(i, 2);
    } else if (['--mode', '--workspace', '--sandbox', '--approval'].includes(args[i])) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      const choices = { mode: Object.keys(MODES), sandbox: SANDBOXES, approval: APPROVALS }[key];
      if (!value || value.startsWith('--') || (choices && !choices.includes(value))) throw new Error(`无效 --${key}`);
      if (Object.hasOwn(permissions, key)) throw new Error(`--${key} 重复`);
      permissions[key] = value;
      args.splice(i, 2);
    } else if (args[i] === '--json') {
      if (json) throw new Error('--json 重复');
      json = true;
      args.splice(i, 1);
    } else i += 1;
  }

  const command = args.shift();
  if (command && !['run', 'resume', 'chat'].includes(command)) throw new Error(`未知命令：${command}`);
  const sessionId = command === 'resume' ? args.shift() : undefined;
  if (command === 'resume' && !sessionId) throw new Error('resume 需要 session id');
  if (command === 'chat' && args.length) throw new Error('chat 不接收问题；单次运行请用 run');
  if (args.some(arg => arg.startsWith('--'))) throw new Error(`未知选项：${args.find(arg => arg.startsWith('--'))}`);
  const prompt = args.join(' ');
  if (json && !prompt) throw new Error('--json 需要单次运行的问题');
  return { mode: prompt ? 'single' : 'interactive', sessionId, prompt, protocol, json, permissions };
}
