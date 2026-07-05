# cc-agent

TypeScript agent service based on `@anthropic-ai/claude-agent-sdk`, with channel adapters for Feishu and WeChat.

By default it reads local credentials from:

- `/Users/zhouyuexing/.youzan-business-assistant/config.json`
- `/Users/zhouyuexing/.claude/settings.json`

```bash
yarn install
cp .env.example .env
yarn dev
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
