import { createHarness } from '../../apps/cli/src/create-harness.js';

const harness = createHarness();
const result = await harness.run('请调用 add 工具计算 17 加 25，然后只回答计算结果。', {
  requireTool: true,
});

for (const event of result.events) {
  process.stdout.write(`${event.seq}. ${event.type}${event.data.name ? ` (${event.data.name})` : ''}\n`);
}
process.stdout.write(`最终回答：${result.finalText}\n`);
