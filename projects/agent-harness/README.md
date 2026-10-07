# Agent Harness

从零到一构建 Agent Harness 的工程实验区。整体边界见 [工程结构](../../05-主题资料/Agent工程/工程结构.md)。

## 当前进度

第一讲已实现真实模型调用的最小闭环：模型调用本地 `add` 工具，Harness 将工具结果交回模型，再取得最终回答。支持 OpenAI Chat Completions 和 Anthropic Messages，二者经 `pi-ai` 转成统一消息与流事件。

```sh
pnpm cli                                        # 开始交互会话
pnpm cli resume <session-id>                    # 恢复并持续交谈
pnpm cli run '请调用 add 计算 17 加 25'            # 单次运行
pnpm cli run --json '请调用 add 计算 17 加 25'     # 单次运行的 JSONL 事件
pnpm example:first-turn                         # 第一讲固定案例
```

工程默认读取根目录的 `.env`；模型调用使用其中的 `HARNESS_BASE_URL`、`HARNESS_AUTH_TOKEN`、`HARNESS_MODEL` 和 `HARNESS_API_PROTOCOL`。Anthropic Messages 默认地址为 `https://zoperation.youzan.com/api/v1/messages`，可用 `HARNESS_ANTHROPIC_*` 配置单独的地址、令牌和模型；未设置时沿用通用令牌和模型。`HARNESS_CONTEXT_WINDOW` 和 `HARNESS_MAX_TOKENS` 提供模型容量配置，示例值需按实际模型核对。真实配置保存在被 Git 忽略的 `.env` 中；[`.env.example`](./.env.example) 列出字段。

交互模式支持 `/id`、`/history`、`/new`、`/help`、`/exit`；工具调用参数与结果直接显示。`Ctrl-C` 在生成时取消当前轮，等待输入时退出。带问题的 `run` 或 `resume` 是单次模式：回答写入标准输出，工具信息写入标准错误；`--json` 将机器可读的事件写入标准输出，其中 `text_delta` 是尚未提交的流片段，`final` 才是最终回答。

每个会话的事件与完整消息逐条写入被忽略的 `.data/sessions/<id>.jsonl`。恢复时，区分未启动工具与执行结果未知的工具，均不会自动重试。新日志使用 v2 格式，不读取之前的实验日志。当前单个 session 只应由一个进程写入。

## 代码入口

- `apps/cli/`：命令行入口与模型、工具、会话的装配。
- `packages/llm/src/contract/` 定义统一消息、请求、流结束原因和错误；`adapters/pi-ai/` 负责协议转换与重放信息。
- `packages/core/src/loop/` 驱动轮次、步骤与工具调用；`tools/` 注册业务工具。
- `packages/session/src/` 分开维护事件格式、消息投影、中断修复和 JSONL 存储。
- `examples/01-minimal-turn/`：第一讲的可运行案例。

## 扩展边界

- 新模型接入实现 LLM 的 `stream(request)` 契约，将增量和唯一的结束事件映射到 `contract/`；协议细节留在对应适配器。
- 新执行策略在 `core/src/loop/` 组合步骤与工具；工具定义通过 `tools/registry.js` 注册，模型适配器不执行工具。
- 新存储后端实现 Session 的 `create/open` 及句柄的 `read/append/flush/close`；事件校验、投影和中断修复继续复用。

运行记录与讲解见 [第一讲](../../05-主题资料/Agent工程/第一讲-从一次任务看懂Agent-Harness.md)。JSON-RPC Server 留待后续课程构建。
