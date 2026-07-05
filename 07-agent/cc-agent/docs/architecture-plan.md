# cc-agent 架构方案

日期：2026-07-05

## 目标

在 `07-agent/cc-agent` 下构建一个 TypeScript 智能体框架，底层使用 `claude_agent_sdk`，上层支持多消息通道。首期通道先支持：

- 飞书 / Lark
- 微信 / WeChat

设计原则：

- Agent 相关能力放一起：Claude SDK、工具、MCP、定时任务、会话、队列、转录记录都归到 `src/agent/`。
- 数据访问单独成层，和 `agent/` 平级放在 `src/db/`，底层使用 SQLite，不用文件存储承载业务数据。
- 通道目录只处理通道协议：入站、出站、鉴权、事件解析、目标路由，不放 Agent 运行逻辑。
- 公共通道入参保持小而稳定，复杂字段留在通道内部转换层，不污染 `ChannelMessage`。
- `channels/*/inbound.ts` 和 `channels/*/outbound.ts` 做薄入口，复杂逻辑放到见名知意的文件里。
- 首期先跑通文本消息链路，再扩展附件、卡片、通讯录、主动发送等能力。

## 参考源码结论

### youzan-business-assistant

可复用的核心边界：

- `AgentRuntime` 只消费统一消息模型，不依赖具体通道 SDK。
- 同一会话串行执行，避免一个群/一个私聊同时打进 Claude session。
- Claude SDK 只封装在单独 client adapter 里。
- 出站通过 callbacks/outbound 回到通道 runtime。
- 通道 runtime 自己恢复 last-mile 目标，避免依赖全局 bot。

本方案调整：

- 不沿用 `account_id`、`channel_session_id` 这些较重字段。
- 改为 `channelId + appId + groupId` 三元组生成 `session_key`，持久化层主要存 `session_key`。
- attachments/raw/isMentioned 不放公共 `ChannelMessage`，后续用通道私有 envelope 或扩展事件处理。

### openclaw

可借鉴的通道能力分面：

- `inbound`：通道事件转统一消息。
- `outbound`：统一输出转通道 API。
- `runtime`：启动/停止 webhook、poller、bridge。
- `config`：通道配置解析。
- `auth`：通道 token/secret/client。
- `routing`：目标、thread、reply target 解析。

本方案不照搬完整 plugin 市场和 doctor/setup wizard 体系，首期保持本地工程内的简单 registry。

## 简化通道协议

公共入站模型固定为：

```ts
export type ChannelId = "feishu" | "wechat";

export type ChannelMessage = {
  channelId: ChannelId;
  appId: string;
  groupId: string;
  threadId?: string;
  senderId?: string;
  senderName?: string;
  replyTo?: string;
  content: string;
  isPrivate: boolean;
  source: "user" | "scheduled" | "background";
};
```

`sessionKey` 不进入 `ChannelMessage`，但进入持久化表。运行时统一由函数生成：

```ts
export function buildSessionKey(message: Pick<ChannelMessage, "channelId" | "appId" | "groupId">): string {
  return [
    message.channelId,
    encodeURIComponent(message.appId),
    encodeURIComponent(message.groupId),
  ].join(":");
}

export function parseSessionKey(sessionKey: string): Pick<ChannelMessage, "channelId" | "appId" | "groupId"> {
  const [channelId, appId, groupId] = sessionKey.split(":");
  if ((channelId !== "feishu" && channelId !== "wechat") || !appId || !groupId) {
    throw new Error(`Invalid session_key: ${sessionKey}`);
  }
  return {
    channelId,
    appId: decodeURIComponent(appId),
    groupId: decodeURIComponent(groupId),
  };
}
```

语义约定：

- `channelId`：通道类型，目前只允许 `feishu` / `wechat`。
- `appId`：通道账号或应用身份。飞书是 app id 或 account alias；微信是 bridge account/app id。
- `groupId`：会话所在群、私聊、频道或 DM 的稳定 id。私聊也用一个稳定 `groupId`，不要另造 `userSessionId`。
- `threadId`：通道内 thread/topic/reply-thread。它参与 Claude client key，但不参与基础 session key。
- `replyTo`：最后一跳回复目标，如飞书 message id、微信 message id；只用于出站定位。
- `source`：用户消息、定时任务、后台任务三类来源。

Claude 会话 key：

```ts
type AgentSessionKey = {
  sessionKey: string; // channelId:appId:groupId
  threadId?: string;
};
```

同一 `(sessionKey, threadId)` 串行执行。没有 `threadId` 时按 `sessionKey` 串行。排队逻辑在 `agent/session/queue.ts`，持久状态写入 SQLite。SQLite 表里优先存 `session_key`，不额外冗余 `channel_id/app_id/group_id`；需要拆解时统一调用 `parseSessionKey()`。

## 总体数据流

```text
HTTP webhook / poller / scheduled task
  -> channels/<id>/runtime.ts
  -> channels/<id>/inbound.ts
  -> ChannelMessage
  -> agent/runtime.ts run(message)
  -> agent/session/queue.ts
  -> agent/sdk/claude-client.ts
  -> agent 输出事件
  -> channels/<id>/outbound.ts
  -> Feishu / WeChat API
```

## 推荐目录结构

```text
07-agent/cc-agent/
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── docs/
│   ├── architecture-plan.md
│   ├── channel-contract.md
│   ├── feishu-setup.md
│   └── wechat-setup.md
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── app.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── server/
│   │   ├── http.ts
│   │   ├── routes.ts
│   │   └── health.ts
│   ├── agent/
│   │   ├── runtime.ts
│   │   ├── index.ts
│   │   ├── model.ts
│   │   ├── prompt.ts
│   │   ├── callbacks.ts
│   │   ├── output-events.ts
│   │   ├── sdk/
│   │   │   ├── claude-client.ts
│   │   │   ├── claude-options.ts
│   │   │   └── claude-message-mapper.ts
│   │   ├── session/
│   │   │   ├── session-key.ts
│   │   │   ├── queue.ts
│   │   │   └── session-manager.ts
│   │   ├── tools/
│   │   │   ├── registry.ts
│   │   │   ├── channel-send.ts
│   │   │   └── index.ts
│   │   ├── mcp/
│   │   │   ├── registry.ts
│   │   │   ├── server-config.ts
│   │   │   └── index.ts
│   │   ├── scheduler/
│   │   │   ├── models.ts
│   │   │   ├── manager.ts
│   │   │   ├── task-store.ts
│   │   │   └── outbound.ts
│   │   └── observability/
│   │       ├── logger.ts
│   │       ├── stats.ts
│   │       └── sdk-log-store.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── connection.ts
│   │   ├── schema.ts
│   │   ├── migrate.ts
│   │   ├── repositories/
│   │   │   ├── sessions.ts
│   │   │   ├── messages.ts
│   │   │   ├── scheduled-tasks.ts
│   │   │   ├── runs.ts
│   │   │   └── sdk-events.ts
│   │   └── migrations/
│   │       └── 001_initial.sql
│   ├── channels/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── feishu/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── runtime.ts
│   │   │   ├── inbound.ts
│   │   │   ├── outbound.ts
│   │   │   ├── client.ts
│   │   │   └── message.ts
│   │   └── wechat/
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── runtime.ts
│   │       ├── inbound.ts
│   │       ├── outbound.ts
│   │       ├── client.ts
│   │       └── message.ts
│   └── utils/
│       ├── async.ts
│       ├── errors.ts
│       └── text.ts
├── tests/
│   ├── agent/
│   │   ├── runtime.test.ts
│   │   ├── session-key.test.ts
│   │   ├── queue.test.ts
│   │   └── scheduler.test.ts
│   ├── channels/
│   │   ├── feishu-inbound.test.ts
│   │   ├── feishu-outbound.test.ts
│   │   ├── wechat-inbound.test.ts
│   │   └── wechat-outbound.test.ts
│   └── fixtures/
│       ├── feishu-message.json
│       └── wechat-message.json
├── data/
│   ├── .gitkeep
│   └── cc-agent.sqlite
└── scripts/
    ├── dev-feishu-webhook.ts
    ├── dev-wechat-webhook.ts
    └── inspect-session.ts
```

## 模块职责

### `src/agent/`

Agent 域内聚所有和智能体运行有关的能力。

- `runtime.ts`：主编排入口，入口方法固定为 `run(message: ChannelMessage)`，负责排队、调用 Claude client、分发输出。
- `model.ts`：Agent 内部类型，如 `AgentRunParams`、`AgentRunResult`、`AgentOutputEvent`。
- `sdk/`：`claude_agent_sdk` adapter。只有这里直接 import SDK。
- `session/`：session key、Claude session id、queue、session manager。业务状态通过 `src/db/repositories/*` 持久化。
- `tools/`：Agent 可用工具注册，包括主动发送通道消息的 `channel-send`。
- `mcp/`：MCP server 配置、启动参数、注入到 Claude SDK options 的逻辑。
- `scheduler/`：定时任务模型、存储、触发、出站构造。
- `observability/`：SDK raw log、usage、运行指标。

工具、MCP、定时任务归到 `agent/` 的原因：

- 它们都属于 Agent 能力面，而不是某个通道的协议细节。
- 它们需要访问 session、Claude SDK options、Agent callbacks。
- 通道只提供出站能力，Agent 决定何时调用工具或定时触发。

### `src/db/`

数据层和 `agent/` 平级，不放在 `agent/` 内部。原因是通道、Agent、scheduler、观测日志都会读写同一个 SQLite，但它们不应该互相穿透目录。

建议职责：

- `connection.ts`：SQLite 连接、WAL、busy timeout、事务封装。
- `schema.ts`：表名、字段类型、轻量 query helper。
- `migrate.ts`：启动时执行 migrations。
- `repositories/`：业务读写封装，禁止上层拼 SQL。
- `migrations/001_initial.sql`：首版建表。

SQLite 配置建议：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### `src/channels/types.ts`

只放通道公共协议：

```ts
export type ChannelRuntime = {
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<ChannelStatus>;
};

export type ChannelOutbound = {
  sendText(params: {
    message: ChannelMessage;
    text: string;
  }): Promise<void>;
};

export type ChannelPlugin = {
  id: ChannelId;
  createRuntime(ctx: ChannelRuntimeContext): ChannelRuntime;
  outbound: ChannelOutbound;
};
```

首期只保留 `sendText`。图片、文件、卡片后续扩展为 `sendMedia` / `sendCard`，不要提前放进 `ChannelMessage`。

### `channels/<id>/runtime.ts`

通道生命周期入口，负责启动 webhook、poller、stream listener 或 bridge listener。

首期保留一个文件承载入口，不再拆 `webhook.ts`、`event-parser.ts` 这类过细文件。入口只负责接收原始事件，然后交给 `client.ts` 和 `message.ts`。

### `channels/<id>/inbound.ts`

薄入口，只做一件事：通道事件转 `ChannelMessage | null`。

```ts
export async function normalizeInbound(input: unknown, ctx: InboundContext): Promise<ChannelMessage | null> {
  const event = await ctx.client.receive(input);
  if (!event) return null;
  return toChannelMessage(event, ctx);
}
```

复杂逻辑下沉到两个文件：

- `client.ts`：通道底层能力，包括鉴权、接收事件、发送文本、发送媒体、回复消息。
- `message.ts`：消息处理，包括原始事件转 `ChannelMessage`、媒体文本提取、回复目标解析。

### `channels/<id>/outbound.ts`

薄入口，只做统一出站协议到通道 API 的派发：

```ts
export async function sendText(params: SendTextParams): Promise<void> {
  const target = resolveReplyTarget(params.message);
  await getClient(params.message.appId).sendText(target, params.text);
}
```

复杂逻辑下沉：

- `message.ts`：根据 `groupId/threadId/replyTo/isPrivate` 算实际目标。
- `client.ts`：调用飞书/微信 API 或 bridge，包括 token、secret、client 初始化。

### `src/agent/scheduler/`

定时任务是 Agent 能力，不放 `channels/`。

定时任务触发时构造同一个 `ChannelMessage`：

```ts
const message: ChannelMessage = {
  channelId,
  appId,
  groupId,
  threadId,
  content,
  isPrivate,
  source: "scheduled",
};
```

然后复用 `AgentRuntime.run(message)`，而不是绕过 Agent runtime 直接调用通道。

### `src/agent/tools/channel-send.ts`

让 Claude 主动发送通道消息时，只通过一个工具进入：

```ts
type ChannelSendInput = {
  channelId: ChannelId;
  appId: string;
  groupId: string;
  threadId?: string;
  content: string;
};
```

工具内部用 `channels/registry.ts` 找对应 outbound。这样 Agent 工具不直接依赖飞书/微信 SDK。

## 飞书通道设计

`channels/feishu/inbound.ts`：

- 接收飞书 webhook body。
- 调用 `client.ts` 解析 challenge / message event。
- 非 message 事件返回 `null`。
- message event 调用 `message.ts` 转为 `ChannelMessage`。

飞书字段映射建议：

- `channelId`: `"feishu"`
- `appId`: 配置中的飞书 app id 或 account alias
- `groupId`: 群聊 `chat_id`；私聊可用 `open_id` 或 `chat_id`
- `threadId`: 飞书 thread/topic/root message id，无则空
- `replyTo`: 原始 message id
- `content`: 纯文本/markdown 降级文本
- `isPrivate`: 根据 chat type 判断

`channels/feishu/outbound.ts`：

- 只暴露 `sendText`。
- 根据 `replyTo/threadId/groupId/isPrivate` 选择发普通消息或回复消息。
- 卡片、图片、文件后续再扩展。

## 微信通道设计

微信首期建议做 bridge，不绑定具体 SDK。

`channels/wechat/inbound.ts` 接收标准 bridge payload：

```ts
type WechatBridgePayload = {
  appId: string;
  groupId: string;
  threadId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  text: string;
  isPrivate: boolean;
};
```

映射：

- `channelId`: `"wechat"`
- `appId`: bridge account id
- `groupId`: 群 id 或私聊 id
- `threadId`: 微信通常为空，除非 bridge 支持 thread/topic
- `replyTo`: `messageId`
- `content`: `text`
- `isPrivate`: payload 原样

`channels/wechat/outbound.ts`：

- 首期向 `WECHAT_BRIDGE_BASE_URL` POST 标准出站 payload。
- 具体个人微信、企微、微信客服的实现放在 bridge 侧或后续 `client.ts` 替换。

## 配置设计

`.env.example` 建议：

```bash
CC_AGENT_HOST=127.0.0.1
CC_AGENT_PORT=8787
CC_AGENT_DATA_DIR=./data
CC_AGENT_WORKSPACE_DIR=./workspace

CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_CODE_PATH=claude
ANTHROPIC_API_KEY=

FEISHU_ENABLED=false
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_ENCRYPT_KEY=

WECHAT_ENABLED=false
WECHAT_APP_ID=default
WECHAT_BRIDGE_BASE_URL=
WECHAT_BRIDGE_TOKEN=
```

后续多账号再升级为 `config.yaml`，但公共模型仍保持 `appId`，不引入 `accountId`。

## SQLite 表结构

首期只用一个库：`data/cc-agent.sqlite`。

```sql
CREATE TABLE agent_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  agent_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_reply_to TEXT,
  last_sender_id TEXT,
  last_sender_name TEXT,
  last_is_private INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_key, thread_id)
);

CREATE TABLE channel_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES agent_sessions(id),
  message_uid TEXT,
  source TEXT NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  reply_to TEXT,
  channel_payload TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(message_uid)
);

CREATE TABLE agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES agent_sessions(id),
  input_message_id INTEGER REFERENCES channel_messages(id),
  status TEXT NOT NULL,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE agent_run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES agent_runs(id),
  event_type TEXT NOT NULL,
  content TEXT,
  event_payload TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE scheduled_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  cron TEXT,
  run_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sdk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES agent_runs(id),
  session_id INTEGER REFERENCES agent_sessions(id),
  level TEXT NOT NULL,
  event_name TEXT NOT NULL,
  sdk_payload TEXT,
  created_at TEXT NOT NULL
);
```

索引建议：

```sql
CREATE INDEX idx_agent_sessions_route ON agent_sessions(session_key);
CREATE INDEX idx_channel_messages_session_created ON channel_messages(session_id, created_at);
CREATE INDEX idx_agent_runs_session_started ON agent_runs(session_id, started_at);
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(enabled, next_run_at);
```

`session_key` 由 `channelId:appId:groupId` 生成，其中 `appId/groupId` 做 URL encode，避免 id 自身包含分隔符。表里只存 `session_key`，不重复存 `channel_id/app_id/group_id`。如果出站或排查需要三段字段，统一通过 `parseSessionKey(session_key)` 拆解。

`thread_id` 在表里用空字符串表示没有 thread，避免 SQLite 的 `UNIQUE(session_key, thread_id)` 在 `NULL` 上允许重复。

不要使用 `raw_json` 这类统一兜底字段名。确实需要存原始载荷时，用当前语义更明确的字段：

- `channel_messages.channel_payload`：通道消息补充载荷。
- `agent_run_events.event_payload`：Agent 事件补充载荷。
- `sdk_events.sdk_payload`：SDK 事件补充载荷。

## 排队与 SDK 实例

### 同一个 sessionKey 的排队

`AgentRuntime.run(message)` 的第一步是计算：

```ts
const sessionKey = buildSessionKey(message);
const queueKey = message.threadId ? `${sessionKey}:${message.threadId}` : sessionKey;
```

然后通过 `SessionQueue.enqueue(queueKey, task)` 串行执行。同一个 `queueKey` 内严格 FIFO；不同 `queueKey` 可以并发。

SQLite 负责保存运行状态，不负责实现内存队列。单进程首期用内存队列即可；如果后续多进程部署，再把 `agent_runs.status` 扩展为 `queued/running/done/failed`，用 SQLite 事务抢占任务。

### 多通道共用一个 SDK 实例

不要让不同消息通道直接共享“同一个 Claude 会话上下文”。更稳的做法是：

- 可以共享同一个 `ClaudeAgentClient` 对象或 SDK adapter，用来复用配置、模型、MCP、工具注册。
- 不能共享同一个 `agent_session_id`，除非它们确实是同一个业务会话。
- `agent_session_id` 必须绑定到 `(sessionKey, threadId)`，并存到 `agent_sessions.agent_session_id`。

也就是说，SDK adapter 是全局单例可以接受，但 Claude conversation/session 必须按会话隔离：

```text
feishu:app-a:chat-1 + thread-a -> agent_session_id A
feishu:app-a:chat-1 + thread-b -> agent_session_id B
wechat:app-x:group-9           -> agent_session_id C
```

`AgentRuntime` 的处理流程：

1. 用 `ChannelMessage` 计算 `sessionKey/threadId`。
2. 查 SQLite 的 `agent_sessions`，没有就创建。
3. 从记录里取 `agent_session_id`。
4. 调用共享的 `ClaudeAgentClient.run({ agentSessionId, input, tools, mcp })`。
5. SDK 返回新的 session id 时回写 `agent_sessions.agent_session_id`。

如果底层 `claude_agent_sdk` 的 client 本身不是线程安全的，则再加一层 `SdkSemaphore`：

- 默认允许不同 `queueKey` 并发。
- 如果实测 SDK client 有共享状态污染，就改成 client pool，或者每次 run 创建短生命周期 client。
- 不要用全局大锁串行所有通道，除非 SDK 明确不支持并发；全局串行会让一个群的慢任务阻塞所有消息通道。

## 首期 MVP

第一阶段：

1. TypeScript 工程骨架：`tsx`、`vitest`、`zod`、`hono` 或 `fastify`。
2. 简化 `ChannelMessage`、`buildSessionKey`、SQLite schema、`SessionQueue`。
3. `AgentRuntime` + fake Claude client 跑通。
4. `ClaudeAgentClient` 封装 `claude_agent_sdk`。
5. `feishu` 文本 webhook 入站 + 文本出站。
6. `wechat` bridge 文本 webhook 入站 + 文本出站。
7. `agent/scheduler` 最小定时任务模型，能构造 `source: "scheduled"` 消息并写入 SQLite。
8. Contract tests：session key、queue、SQLite repositories、feishu inbound、wechat inbound、scheduler message。

第一阶段不做：

- 附件、图片、文件、卡片
- 通讯录/directory
- setup wizard
- session gate/quota
- web UI
- OpenClaw 式插件市场

## 实现顺序

1. 建工程骨架和类型 contract。
2. 实现 `ChannelMessage`、`buildSessionKey`、SQLite migration、`SessionQueue`。
3. 实现 `AgentRuntime`，使用 fake Claude client 验证主链路。
4. 接入 `claude_agent_sdk` adapter。
5. 接 `feishu/inbound.ts` 和 `feishu/outbound.ts`。
6. 接 `wechat/inbound.ts` 和 `wechat/outbound.ts`。
7. 加 message/run/event 持久化、scheduler。
8. 再扩 MCP、tools、附件、主动发送。

## 风险点

- `claude_agent_sdk` 的 TypeScript API 需要以实际包版本为准，所以必须隔离在 `agent/sdk/`。
- 微信接入方式不确定，首期 bridge contract 是最低风险做法。
- `ChannelMessage` 刻意保持简洁，附件和 raw 调试信息不要塞回公共模型；如果需要，另建 `ChannelEnvelope` 给通道内部和日志使用。
- `threadId` 不参与基础 `sessionKey`，但参与 Claude client key，避免 topic 并发互相污染。
- 共享 SDK adapter 不等于共享 Claude 会话。真正需要隔离的是 `agent_session_id`，它必须绑定到 `(sessionKey, threadId)`。
