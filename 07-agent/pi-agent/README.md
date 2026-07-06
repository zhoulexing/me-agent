# pi-agent

TypeScript agent service based on [`earendil-works/pi`](https://github.com/earendil-works/pi), with the same outer architecture and channel adapters as `cc-agent`.

Architecture parity with `cc-agent` is tracked in `docs/parity.md`.

The only intended runtime difference is the agent SDK:

- `pi-agent`: `@earendil-works/pi-coding-agent`
- `cc-agent`: `@anthropic-ai/claude-agent-sdk`

Runtime configuration comes from `.env` or process environment variables only.
The local `.env` contains the extracted Feishu, workspace, and model provider
settings needed for this machine. Set `PI_AGENT_API=openai-responses`,
`PI_AGENT_PROVIDER_ID=local-codex`, and `PI_AGENT_BASE_URL` when you want to
force a Codex/OpenAI-compatible endpoint.

```bash
npm install --cache .npm-cache
npm run dev
```

Feishu uses the official SDK WebSocket client. After `FEISHU_ENABLED=true`,
`FEISHU_APP_ID`, and `FEISHU_APP_SECRET` are configured in `.env`, just run:

```bash
npm run dev
```

The app will connect with `@larksuiteoapi/node-sdk` `WSClient`. In the Feishu
developer console, make sure event subscription mode is set to long connection:
Events and Callbacks -> Mode of event/callback subscription -> Receive
events/callbacks through persistent connection.

WeChat bridge endpoint:

```text
POST /channels/wechat/events
```

Local non-streaming test:

```bash
curl -sS -X POST http://127.0.0.1:8787/agent/messages \
  -H 'content-type: application/json' \
  -d '{"content":"用中文回复两个字：你好","channelId":"wechat","appId":"local","groupId":"local-test","isPrivate":true}'
```

Local streaming test:

```bash
curl -sS -N -X POST http://127.0.0.1:8787/agent/messages/stream \
  -H 'content-type: application/json' \
  -d '{"content":"用中文回复两个字：你好","channelId":"wechat","appId":"local","groupId":"local-stream-test","isPrivate":true}'
```

Agent data APIs:

```text
GET /agent-data/sessions
GET /agent-data/sessions/:agent_session_id/messages
GET /agent-data/sessions/:agent_session_id/runs
GET /agent-data/runs/:id/events
GET /agent-data/sdk-events
```

Verification:

```bash
npm run verify
npm run doctor
npm run e2e:agent
```
