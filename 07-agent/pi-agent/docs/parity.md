# cc-agent / pi-agent Parity

This project is the Pi implementation of the shared local agent architecture.

The sibling `../cc-agent` project must keep the same outer architecture and channel behavior. The intended differences are limited to the agent SDK adapter:

- `cc-agent`: `@anthropic-ai/claude-agent-sdk`
- `pi-agent`: `@earendil-works/pi-coding-agent`

## Shared Contract

Both projects expose the same HTTP routes:

- `GET /health`
- `POST /agent/messages`
- `POST /agent/messages/stream`
- `POST /channels/feishu/events`
- `POST /channels/wechat/events`
- `GET /agent-data/sessions`
- `GET /agent-data/sessions/:id`
- `GET /agent-data/sessions/:id/messages`
- `GET /agent-data/sessions/:id/runs`
- `GET /agent-data/messages`
- `GET /agent-data/runs`
- `GET /agent-data/runs/:id`
- `GET /agent-data/runs/:id/events`
- `GET /agent-data/sdk-events`

Both projects use the same channel-to-agent protocol:

- Inbound channel code builds `AgentRunParams`.
- `AgentRuntime.run()` is non-streaming.
- `AgentRuntime.runStream()` is streaming.
- Outbound channel code is driven through `AgentRunCallbacks`.
- `agent_session_id` is the only public name for the SDK session id.

Both projects persist the same SQLite business tables:

- `agent_sessions`
- `channel_messages`
- `agent_runs`
- `agent_run_events`
- `sdk_events`
- `scheduled_tasks`

`session_key` is stored as the canonical persisted session identity. The three channel identity fields are encoded and decoded only through the shared session-key helpers.

## Expected Differences

The following differences are intentional:

- SDK client files: `ClaudeAgentClient` versus `PiAgentClient`.
- SDK option builders: Claude SDK options versus Pi session/model/resource options.
- MCP server name: `cc_agent` versus `pi_agent`.
- Tool factory implementation: Claude `tool()` versus Pi `defineTool()`.
- Environment variable prefix and model provider configuration.
- SQLite file name: `cc-agent.sqlite` versus `pi-agent.sqlite`.
- Prompt wording may include the concrete project name.

Anything outside those areas should be treated as a parity drift unless there is a concrete reason.

## Verification

Run these commands in each project:

```bash
npm run typecheck
npm run build
npm test
npm run smoke
npm run verify
```

The dist build must include:

- `dist/agent/prompts/*`
- `dist/db/migrations/001_initial.sql`
- `dist/channels/feishu/streaming-card-reply.js`

## External E2E

`npm run verify` is intentionally local and repeatable. It does not call a real model.

Use these commands when external services are available:

```bash
npm run doctor
npm run doctor -- --strict-channels
npm run e2e:agent
```

`doctor --strict-channels` requires both Feishu and WeChat to be enabled. `e2e:agent` calls the real SDK/model using the current local config and temporary data directories.

Current known external blockers:

- `pi-agent` uses OpenAI Responses with the configured OpenAI-compatible key. A quota or billing failure is an external provider/key issue, not an architecture parity failure.
- WeChat bridge e2e requires `WECHAT_ENABLED=true` and `WECHAT_BRIDGE_BASE_URL`.
