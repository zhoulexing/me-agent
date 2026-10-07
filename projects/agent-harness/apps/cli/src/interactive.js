import { createInterface } from 'node:readline';
import { createHumanRenderer, printHistory } from './render.js';

export async function runInteractive({ harness, sessionId: initialSessionId, input = process.stdin, output = process.stdout }) {
  let sessionId = initialSessionId;
  if (sessionId) {
    const history = await harness.history(sessionId);
    output.write(`已恢复会话：${sessionId}\n`);
    printHistory(history.messages, output);
  } else output.write('新会话。输入 /help 查看命令。\n');

  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY), historySize: 100 });
  const renderer = createHumanRenderer({ output, diagnostics: output, interactive: true,
    initialSessionId: sessionId });
  let active;
  rl.on('SIGINT', () => {
    if (active && !active.signal.aborted) {
      active.abort(new Error('用户取消'));
      output.write('\n[已请求取消本轮]\n');
    } else if (!active) rl.close();
  });
  rl.setPrompt('你> ');
  rl.prompt();
  try {
    for await (const raw of rl) {
      const prompt = raw.trim();
      if (!prompt) { rl.prompt(); continue; }
      if (prompt === '/exit' || prompt === '/quit') break;
      if (prompt === '/help') {
        output.write('/id 查看会话 ID；/history 查看最近消息；/new 开始新会话；/exit 退出。Ctrl-C 取消本轮。\n');
      } else if (prompt === '/id') {
        output.write(`${sessionId ?? '尚未建立会话'}\n`);
      } else if (prompt === '/new') {
        sessionId = undefined;
        output.write('下一条消息将创建新会话。\n');
      } else if (prompt === '/history') {
        if (sessionId) printHistory((await harness.history(sessionId)).messages, output);
        else output.write('尚未建立会话。\n');
      } else if (prompt.startsWith('/')) {
        output.write('未知命令，输入 /help 查看命令。\n');
      } else {
        active = new AbortController();
        try {
          const result = await harness.run(prompt, {
            sessionId, signal: active.signal,
            onEvent(event) {
              if (event.type === 'turn.started') sessionId = event.data.sessionId;
              renderer.onEvent(event);
            },
          });
          sessionId = result.sessionId;
          renderer.finish(result.finalText);
        } catch (error) {
          renderer.breakLine();
          output.write(active.signal.aborted ? '[本轮已取消]\n' : `[运行失败] ${error.message}\n`);
        } finally { active = undefined; }
      }
      rl.prompt();
    }
  } finally { rl.close(); }
}
