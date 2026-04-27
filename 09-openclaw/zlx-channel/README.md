# zlx-channel

OpenClaw webhook channel plugin for external systems.

## Installation

```bash
npm install zlx-channel
# or
yarn add zlx-channel
# or
pnpm add zlx-channel
```

## Configuration

Add to your OpenClaw config (`~/.openclaw/config.json` or via `openclaw config`):

```json
{
  "channels": {
    "zlx": {
      "webhookPath": "/zlx-webhook",
      "webhookSecret": "your-secret-token",
      "outboundUrl": "https://your-external-system.com/webhook/send",
      "accounts": [
        {
          "id": "default",
          "outboundUrl": "https://your-external-system.com/webhook/send"
        }
      ]
    }
  }
}
```

### Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `webhookPath` | `string` | HTTP path for webhook callback (default: `/zlx-webhook`) |
| `webhookSecret` | `string` | Secret token for signature verification |
| `outboundUrl` | `string` | URL to send outbound messages to |
| `accounts` | `array` | Multiple account configurations |

## Webhook Payload

Send messages to OpenClaw via POST:

```json
{
  "message": {
    "id": "msg-123",
    "text": "Hello AI",
    "senderId": "user-1",
    "senderName": "User Name",
    "conversation": {
      "id": "conv-1",
      "kind": "direct"
    },
    "timestamp": 1710000000000,
    "threadId": "thread-1",
    "replyToId": "msg-122"
  }
}
```

## Signature Verification

Include the secret in the `X-Zlx-Webhook-Secret` header:

```
X-Zlx-Webhook-Secret: your-secret-token
```

## Outbound Messages

When AI responds, messages are sent to `outboundUrl` as POST:

```json
{
  "id": "msg-456",
  "text": "AI Response",
  "target": "dm:user-1",
  "threadId": null,
  "replyToId": "msg-123",
  "senderId": "openclaw",
  "senderName": "OpenClaw Bot"
}
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck
```

## Standalone Server

`zlx-channel` includes a standalone Hono server for local development or standalone usage:

```bash
# Run the server
pnpm dev
```

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ZLX_PORT` | Server port | `3000` |
| `ZLX_WEBHOOK_SECRET` | Signature verification secret | (none) |
| `ZLX_OUTBOUND_URL` | URL to forward outbound messages | (none) |

### Standalone Server Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Health check |
| POST | `/webhook` | Receive messages |
| GET | `/messages/:conversationId` | Get conversation messages |
| POST | `/send` | Send a message (for testing) |