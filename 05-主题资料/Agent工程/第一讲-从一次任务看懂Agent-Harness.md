# 第一讲：从一次任务看懂 Agent Harness

## 本讲要回答的问题

模型提出调用工具后，谁来执行、记录结果、继续请求模型，并判断这一轮何时结束？本讲用一个真实模型请求和本地 `add` 工具跑通这条链路。ReAct 的“行动—观察—继续推理”可用于理解这个循环；本工程先实现执行与状态边界，再逐步扩展。[ReAct 论文](https://arxiv.org/abs/2210.03629)

## 案例与代码

任务：调用 `add` 计算 17 + 25，然后回答结果。模型请求使用 `projects/agent-harness/.env` 中的 API 地址、模型和 token；该文件已被 Git 忽略。

```text
CLI 输入
  → CLI 装配模型、工具与会话
  → Agent Loop 向真实模型发出请求
  → 模型返回 add 工具调用
  → Harness 校验参数并执行本地工具，记录结果
  → Agent Loop 将结果交回模型
  → 模型回答 42，轮次结束
```

对应代码：[CLI](../../projects/agent-harness/apps/cli/src/cli.js)、[装配](../../projects/agent-harness/apps/cli/src/create-harness.js)、[Agent Loop](../../projects/agent-harness/packages/core/src/loop/run-turn.js)、[会话](../../projects/agent-harness/packages/session/src/session.js)、[工具](../../projects/agent-harness/packages/core/src/tools/registry.js)、[模型契约](../../projects/agent-harness/packages/llm/src/contract/index.js)、[pi-ai 适配](../../projects/agent-harness/packages/llm/src/adapters/pi-ai/adapter.js)。

## 实际运行

在 `projects/agent-harness/` 执行：

```sh
pnpm example:first-turn
```

本次真实调用的事件顺序：`turn.started → step.started → model.responded → tool.started(add) → tool.completed(add) → step.completed → step.started → model.responded → step.completed → turn.completed`；最终回答为 `42`。OpenAI Chat 与 Anthropic Messages 的真实网关调用均已跑通。`pi-ai` 负责协议转换，CLI 在收到文本增量时直接输出；完整统一消息写入会话日志，适配器重放信息随消息保存。

会话日志位于工程内的 `.data/sessions/`。再次提问用 `pnpm cli resume <session-id>` 进入持续对话，或用 `pnpm cli resume <session-id> '新问题'` 单次运行；交互界面显示工具调用和结果。`Ctrl-C` 将取消信号传给模型和工具。恢复时，若工具调用已记录但结果尚未落盘，会标记为“结果未知”，不会自动再执行。

`turn.completed` 只表示本轮执行结束。案例中的加法结果由本地工具计算，并通过真实调用的最终回答核对；处理文件、网页或外部业务时，还需要针对目标状态做独立验证。下一步再研究工具失败、权限与执行预算。
