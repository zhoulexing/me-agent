import { createHumanRenderer } from './render.js';
import { createJsonRenderer } from './render-json.js';
import { createInterface } from 'node:readline';
import { createLineReader, terminalApprover } from './approval.js';

export async function runSingle({ harness, prompt, sessionId, json, input = process.stdin, output = process.stdout, diagnostics = process.stderr }) {
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('用户取消'));
  const rl = input.isTTY && !json ? createInterface({ input, output: diagnostics, terminal: true }) : undefined;
  rl?.on('SIGINT', cancel);
  const requestApproval = rl ? terminalApprover({ reader: createLineReader(rl), output: diagnostics, enabled: true }) : undefined;
  process.once('SIGINT', cancel);
  const renderer = json
    ? createJsonRenderer(output)
    : createHumanRenderer({ output, diagnostics });
  try {
    const result = await harness.run(prompt, {
      sessionId, signal: controller.signal, requestApproval,
      onEvent: event => renderer.onEvent(event),
    });
    if (json) renderer.final(result);
    else renderer.finish(result.finalText);
    return 0;
  } catch (error) {
    if (json) renderer.error(error);
    else {
      renderer.breakLine();
      diagnostics.write(`运行失败：${error.message}\n`);
    }
    return controller.signal.aborted ? 130 : 1;
  } finally {
    rl?.close();
    process.removeListener('SIGINT', cancel);
  }
}
