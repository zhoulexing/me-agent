#!/usr/bin/env node

const usage = `Agent Harness 工程骨架

用法：agent-harness --help

后续课程将逐步加入 run 和 server 命令。\n`;

const args = process.argv.slice(2);

if (args.length === 0 || (args.length === 1 && ['--help', '-h'].includes(args[0]))) {
  process.stdout.write(usage);
} else {
  process.stderr.write(`未知命令：${args.join(' ')}\n`);
  process.exitCode = 2;
}
