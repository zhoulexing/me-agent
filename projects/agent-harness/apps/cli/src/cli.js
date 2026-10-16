#!/usr/bin/env node

import { parseArgs, usage } from './args.js';
import { createHarness } from './create-harness.js';
import { runInteractive } from './interactive.js';
import { runSingle } from './single.js';

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'help') process.stdout.write(usage);
  else {
    const harness = createHarness({ protocol: args.protocol, ...args.permissions });
    if (args.mode === 'interactive') await runInteractive({ harness, sessionId: args.sessionId });
    else process.exitCode = await runSingle({ harness, ...args });
  }
} catch (error) {
  process.stderr.write(`运行失败：${error.message}\n`);
  process.exitCode = 1;
}
