import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createToolRegistry, runTurn } from '@agent-harness/core';
import { createPiAiAdapter } from '@agent-harness/llm';
import { createSessionStore } from '@agent-harness/session';

const addTool = {
  name: 'add',
  description: '计算两个数字之和。需要加法时调用。',
  parameters: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
  execute({ a, b }) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error('add 要求 a 和 b 都是有限数字');
    }
    return { sum: a + b };
  },
};

export function createHarness({ maxSteps = 4, protocol } = {}) {
  const localEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(localEnv)) loadEnvFile(localEnv);
  const selectedProtocol = protocol ?? process.env.HARNESS_API_PROTOCOL ?? 'openai-completions';
  const model = createPiAiAdapter({
    protocol: selectedProtocol,
    baseUrl: selectedProtocol === 'anthropic-messages'
      ? process.env.HARNESS_ANTHROPIC_BASE_URL ?? 'https://zoperation.youzan.com/api/v1/messages'
      : process.env.HARNESS_BASE_URL,
    authToken: selectedProtocol === 'anthropic-messages'
      ? process.env.HARNESS_ANTHROPIC_AUTH_TOKEN ?? process.env.HARNESS_AUTH_TOKEN
      : process.env.HARNESS_AUTH_TOKEN,
    model: selectedProtocol === 'anthropic-messages'
      ? process.env.HARNESS_ANTHROPIC_MODEL ?? process.env.HARNESS_MODEL
      : process.env.HARNESS_MODEL,
    contextWindow: Number(process.env.HARNESS_CONTEXT_WINDOW ?? 128_000),
    maxTokens: Number(process.env.HARNESS_MAX_TOKENS ?? 512),
  });
  const tools = createToolRegistry([addTool]);
  const store = createSessionStore({ directory: fileURLToPath(new URL('../../../.data/sessions/', import.meta.url)) });

  return {
    async history(sessionId) {
      const session = await store.open(sessionId);
      try {
        await session.repairInterrupted();
        return { sessionId, messages: session.messages, events: session.events };
      } finally {
        await session.close();
      }
    },
    async run(prompt, { sessionId, requireTool = false, signal, onEvent } = {}) {
      const session = sessionId ? await store.open(sessionId) : await store.create({
        systemPrompt: '你是一个简洁的助手。加法计算使用 add 工具，并根据工具结果作答。',
      });
      try {
        if (sessionId) await session.repairInterrupted();
        return await runTurn({ model, tools, session, userInput: prompt, maxSteps, requireTool, signal, onEvent });
      } finally {
        await session.close();
      }
    },
  };
}
