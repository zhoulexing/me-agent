# cc-agent

Python 3.11 agent runtime using `claude_agent_sdk` and `uv`.

## Runtime Flow

```text
channels/<id>/runtime.py
  -> AgentRunParams
  -> agent/session.py run(params, callbacks)
  -> agent/client.py query / receive SDK messages
  -> AgentRunCallbacks
  -> channels/<id> outbound behavior
```

## Start

```bash
cd 07-agent/cc-agent
uv sync
./start.sh
```

Health check:

```bash
curl http://127.0.0.1:8080/health
```

Run an agent message through the HTTP gateway:

```bash
curl -X POST http://127.0.0.1:8080/api/agent/run \
  -H 'content-type: application/json' \
  -d '{"channelId":"feishu","appId":"local","groupId":"cli","senderId":"u1","content":"hello","isPrivate":false,"source":"user"}'
```

## Storage Contract

SQLite stores `session_key` as the canonical channel session identity. Tables do
not duplicate `channel_id`, `app_id`, or `group_id`. Use
`build_session_key(channel_id, app_id, group_id)` and `parse_session_key()` at
adapter boundaries.
