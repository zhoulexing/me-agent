const limit = (value, max = 800) => value.length > max ? `${value.slice(0, max)}…` : value;

function describe(value) {
  try { return limit(JSON.stringify(value)); } catch { return '[无法序列化]'; }
}

export function createHumanRenderer({ output = process.stdout, diagnostics = process.stderr,
  interactive = false, initialSessionId } = {}) {
  const details = interactive ? output : diagnostics;
  let textSeen = false;
  let lineOpen = false;
  let announcedSession = initialSessionId;
  const closeLine = () => {
    if (lineOpen) output.write('\n');
    lineOpen = false;
  };

  return {
    onEvent(event) {
      if (event.type === 'turn.started') {
        textSeen = false;
        if (announcedSession !== event.data.sessionId) {
          details.write(`会话：${event.data.sessionId}\n`);
          announcedSession = event.data.sessionId;
        }
      } else if (event.type === 'text.delta') {
        if (!textSeen && interactive) output.write('助手> ');
        textSeen = true;
        output.write(event.text);
        lineOpen = !event.text.endsWith('\n');
      } else if (event.type === 'tool.started') {
        closeLine();
        details.write(`[工具] ${event.data.name} ${describe(event.data.arguments)}\n`);
      } else if (event.type === 'message.appended' && event.data.message.role === 'tool') {
        closeLine();
        const message = event.data.message;
        const result = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        details.write(`[${message.isError ? '工具错误' : '工具结果'}] ${message.name}: ${limit(result)}\n`);
      }
    },
    finish(finalText) {
      if (!textSeen) {
        if (interactive) output.write('助手> ');
        output.write(finalText);
        lineOpen = true;
      }
      closeLine();
    },
    breakLine: closeLine,
  };
}

export function printHistory(messages, output = process.stdout) {
  const recent = messages.slice(-8);
  if (recent.length === 0) return;
  output.write('最近消息：\n');
  for (const message of recent) {
    const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
    const calls = message.content.filter(block => block.type === 'tool-call').map(block => block.name);
    const body = text || (calls.length ? `调用工具 ${calls.join('、')}` : '（无可见文本）');
    const label = { user: '你', assistant: '助手', tool: '工具' }[message.role] ?? message.role;
    output.write(`  ${label}: ${limit(body.replace(/\s+/g, ' '), 240)}\n`);
  }
}
