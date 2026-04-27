import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { validateZlxWebhookSecret, safeEqualSecret } from "./security.js";

const app = new Hono();

// 配置
const PORT = Number(process.env.ZLX_PORT ?? 3000);
const WEBHOOK_SECRET = process.env.ZLX_WEBHOOK_SECRET ?? "";
const OUTBOUND_URL = process.env.ZLX_OUTBOUND_URL ?? "";
const OPENCLAW_WEBHOOK_URL = process.env.OPENCLAW_WEBHOOK_URL ?? "http://127.0.0.1:18789/zlx-webhook";

// 内存存储（简单场景）
type StoredMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  timestamp: number;
  direction: "inbound" | "outbound";
  threadId?: string;
  replyToId?: string;
};

type ConversationRecord = {
  id: string;
  kind: "direct" | "channel";
  title?: string;
  lastMessageAt: number;
  messageCount: number;
};

const messageStore = new Map<string, StoredMessage[]>();
const conversationStore = new Map<string, ConversationRecord>();

function getConversationMessages(conversationId: string) {
  if (!messageStore.has(conversationId)) {
    messageStore.set(conversationId, []);
  }
  return messageStore.get(conversationId)!;
}

function upsertConversation(params: {
  id: string;
  kind?: "direct" | "channel";
  title?: string;
  timestamp?: number;
}) {
  const existing = conversationStore.get(params.id);
  const messageCount = getConversationMessages(params.id).length;
  conversationStore.set(params.id, {
    id: params.id,
    kind: params.kind ?? existing?.kind ?? "direct",
    title: params.title ?? existing?.title,
    lastMessageAt: params.timestamp ?? existing?.lastMessageAt ?? Date.now(),
    messageCount,
  });
}

function renderConversationPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zlx Channel Console</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --line: #d9dee7;
      --text: #17202a;
      --muted: #657182;
      --soft: #eef2f6;
      --accent: #0f766e;
      --accent-ink: #ffffff;
      --inbound: #f4f6f8;
      --outbound: #e5f6f3;
      --danger: #b42318;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100svh;
      background: var(--bg);
      color: var(--text);
    }
    button, input, textarea {
      font: inherit;
    }
    .shell {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr) 320px;
      min-height: 100svh;
    }
    aside, main {
      min-width: 0;
    }
    .sidebar {
      border-right: 1px solid var(--line);
      background: #fbfcfd;
      display: flex;
      flex-direction: column;
    }
    .brand {
      padding: 22px 20px 16px;
      border-bottom: 1px solid var(--line);
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .brand p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .toolbar {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 14px;
      border-bottom: 1px solid var(--line);
    }
    .field {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      padding: 9px 10px;
      outline: none;
    }
    .field:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
    }
    .icon-button, .text-button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      min-height: 38px;
      padding: 0 12px;
      cursor: pointer;
    }
    .icon-button {
      width: 40px;
      font-size: 18px;
      line-height: 1;
    }
    .text-button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
    }
    .conversation-list {
      overflow: auto;
      padding: 8px;
    }
    .conversation-row {
      display: grid;
      gap: 5px;
      width: 100%;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      padding: 11px 12px;
      text-align: left;
      cursor: pointer;
    }
    .conversation-row:hover {
      background: var(--soft);
    }
    .conversation-row.active {
      background: #dff3ef;
    }
    .row-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .conversation-id {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 650;
    }
    .badge {
      flex: 0 0 auto;
      border-radius: 999px;
      background: #e8edf2;
      color: var(--muted);
      padding: 2px 7px;
      font-size: 11px;
    }
    .row-meta {
      color: var(--muted);
      font-size: 12px;
    }
    .workspace {
      display: flex;
      flex-direction: column;
      min-height: 100svh;
    }
    .topbar {
      min-height: 72px;
      padding: 16px 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .title-block {
      min-width: 0;
    }
    .title-block h2 {
      margin: 0;
      font-size: 17px;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .title-block p {
      margin: 5px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    .timeline {
      flex: 1;
      overflow: auto;
      padding: 24px;
    }
    .empty {
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--muted);
      text-align: center;
      line-height: 1.6;
    }
    .message {
      display: grid;
      gap: 6px;
      max-width: 780px;
      margin: 0 0 18px;
      animation: rise 180ms ease-out both;
    }
    .message.outbound {
      margin-left: auto;
    }
    .message-head {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .message.outbound .message-head {
      justify-content: flex-end;
    }
    .bubble {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--inbound);
      padding: 12px 13px;
      white-space: pre-wrap;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
    .message.outbound .bubble {
      background: var(--outbound);
      border-color: #b7ded7;
    }
    .composer {
      border-top: 1px solid var(--line);
      background: #fff;
      padding: 14px 18px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }
    .composer textarea {
      min-height: 42px;
      max-height: 140px;
      resize: vertical;
    }
    .inspector {
      border-left: 1px solid var(--line);
      background: #fbfcfd;
      padding: 20px;
      overflow: auto;
    }
    .section {
      border-bottom: 1px solid var(--line);
      padding: 0 0 18px;
      margin: 0 0 18px;
    }
    .section:last-child {
      border-bottom: 0;
    }
    .section h3 {
      margin: 0 0 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .kv {
      display: grid;
      grid-template-columns: 94px minmax(0, 1fr);
      gap: 9px 12px;
      font-size: 13px;
    }
    .kv span:nth-child(odd) {
      color: var(--muted);
    }
    .kv span:nth-child(even) {
      overflow-wrap: anywhere;
    }
    pre {
      margin: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #111827;
      color: #d8dee9;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      max-height: 360px;
    }
    .status {
      color: var(--muted);
      font-size: 12px;
    }
    .status.error {
      color: var(--danger);
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 1020px) {
      .shell {
        grid-template-columns: 240px minmax(0, 1fr);
      }
      .inspector {
        display: none;
      }
    }
    @media (max-width: 760px) {
      .shell {
        grid-template-columns: 1fr;
      }
      .sidebar {
        max-height: 42svh;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }
      .timeline {
        padding: 16px;
      }
      .composer {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <h1>Zlx Channel Console</h1>
        <p>查看入站消息、OpenClaw 回复和当前会话状态。</p>
      </div>
      <div class="toolbar">
        <input id="conversationInput" class="field" placeholder="conversation id" />
        <button id="openButton" class="icon-button" title="打开会话">→</button>
      </div>
      <div id="conversationList" class="conversation-list"></div>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <div class="title-block">
          <h2 id="conversationTitle">未选择会话</h2>
          <p id="conversationSubtitle">选择左侧会话，或输入 conversation id。</p>
        </div>
        <div class="actions">
          <span id="status" class="status">Ready</span>
          <button id="refreshButton" class="text-button">刷新</button>
        </div>
      </header>
      <section id="timeline" class="timeline">
        <div class="empty">暂无会话。<br />通过 OpenClaw webhook 发一条测试消息后会显示在这里。</div>
      </section>
      <form id="composer" class="composer">
        <textarea id="messageInput" class="field" placeholder="向当前会话发送一条用户消息"></textarea>
        <button class="text-button primary" type="submit">发送</button>
      </form>
    </main>
    <aside class="inspector">
      <div class="section">
        <h3>Conversation</h3>
        <div id="conversationMeta" class="kv"></div>
      </div>
      <div class="section">
        <h3>Messages JSON</h3>
        <pre id="jsonPreview">[]</pre>
      </div>
    </aside>
  </div>
  <script>
    const state = { conversations: [], selectedId: new URLSearchParams(location.search).get("conversation") || "" };
    const els = {
      conversationInput: document.getElementById("conversationInput"),
      openButton: document.getElementById("openButton"),
      refreshButton: document.getElementById("refreshButton"),
      conversationList: document.getElementById("conversationList"),
      conversationTitle: document.getElementById("conversationTitle"),
      conversationSubtitle: document.getElementById("conversationSubtitle"),
      conversationMeta: document.getElementById("conversationMeta"),
      timeline: document.getElementById("timeline"),
      jsonPreview: document.getElementById("jsonPreview"),
      status: document.getElementById("status"),
      composer: document.getElementById("composer"),
      messageInput: document.getElementById("messageInput")
    };

    function setStatus(text, error = false) {
      els.status.textContent = text;
      els.status.classList.toggle("error", error);
    }

    function formatTime(value) {
      if (!value) return "-";
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(value));
    }

    function selectConversation(id) {
      state.selectedId = id;
      els.conversationInput.value = id;
      history.replaceState(null, "", id ? "?conversation=" + encodeURIComponent(id) : location.pathname);
      void loadMessages();
      renderConversationList();
    }

    function renderConversationList() {
      if (!state.conversations.length) {
        els.conversationList.innerHTML = '<div class="empty">暂无会话</div>';
        return;
      }
      els.conversationList.innerHTML = "";
      for (const item of state.conversations) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "conversation-row" + (item.id === state.selectedId ? " active" : "");
        row.innerHTML =
          '<div class="row-top"><span class="conversation-id"></span><span class="badge"></span></div>' +
          '<div class="row-meta"></div>';
        row.querySelector(".conversation-id").textContent = item.title || item.id;
        row.querySelector(".badge").textContent = String(item.messageCount);
        row.querySelector(".row-meta").textContent = item.kind + " · " + formatTime(item.lastMessageAt);
        row.addEventListener("click", () => selectConversation(item.id));
        els.conversationList.appendChild(row);
      }
    }

    function renderMeta(conversation, messages) {
      const rows = [
        ["ID", state.selectedId || "-"],
        ["类型", conversation?.kind || "-"],
        ["标题", conversation?.title || "-"],
        ["消息数", String(messages.length)],
        ["最后更新", formatTime(conversation?.lastMessageAt || messages.at(-1)?.timestamp)]
      ];
      els.conversationMeta.innerHTML = "";
      for (const [key, value] of rows) {
        const label = document.createElement("span");
        const data = document.createElement("span");
        label.textContent = key;
        data.textContent = value;
        els.conversationMeta.append(label, data);
      }
    }

    function renderMessages(messages) {
      if (!state.selectedId) {
        els.timeline.innerHTML = '<div class="empty">暂无会话。<br />通过 OpenClaw webhook 发一条测试消息后会显示在这里。</div>';
        return;
      }
      if (!messages.length) {
        els.timeline.innerHTML = '<div class="empty">当前会话没有消息。</div>';
        return;
      }
      els.timeline.innerHTML = "";
      for (const message of messages) {
        const item = document.createElement("article");
        item.className = "message " + (message.direction === "outbound" ? "outbound" : "inbound");
        const head = document.createElement("div");
        head.className = "message-head";
        head.textContent = (message.senderName || message.senderId || "unknown") + " · " + formatTime(message.timestamp) + " · " + message.id;
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = message.text || "";
        item.append(head, bubble);
        els.timeline.appendChild(item);
      }
      els.timeline.scrollTop = els.timeline.scrollHeight;
    }

    async function loadConversations() {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("conversations " + res.status);
      const data = await res.json();
      state.conversations = data.conversations || [];
      if (!state.selectedId && state.conversations[0]) {
        state.selectedId = state.conversations[0].id;
        els.conversationInput.value = state.selectedId;
      }
      renderConversationList();
    }

    async function loadMessages() {
      if (!state.selectedId) {
        renderMessages([]);
        renderMeta(null, []);
        els.jsonPreview.textContent = "[]";
        return;
      }
      setStatus("Loading");
      const res = await fetch("/messages/" + encodeURIComponent(state.selectedId));
      if (!res.ok) throw new Error("messages " + res.status);
      const data = await res.json();
      const messages = data.messages || [];
      const conversation = state.conversations.find((item) => item.id === state.selectedId);
      els.conversationTitle.textContent = conversation?.title || state.selectedId;
      els.conversationSubtitle.textContent = (conversation?.kind || "direct") + " · " + messages.length + " messages";
      renderMessages(messages);
      renderMeta(conversation, messages);
      els.jsonPreview.textContent = JSON.stringify(messages, null, 2);
      setStatus("Updated " + formatTime(Date.now()));
    }

    async function refresh() {
      try {
        await loadConversations();
        await loadMessages();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), true);
      }
    }

    els.openButton.addEventListener("click", () => selectConversation(els.conversationInput.value.trim()));
    els.conversationInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") selectConversation(els.conversationInput.value.trim());
    });
    els.refreshButton.addEventListener("click", () => void refresh());
    els.composer.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = els.messageInput.value.trim();
      if (!state.selectedId || !text) return;
      setStatus("Waiting for OpenClaw");
      const res = await fetch("/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "ui-" + Date.now(),
          text,
          senderId: "ui-user",
          senderName: "Console User",
          conversation: {
            id: state.selectedId,
            kind: "direct"
          },
          timestamp: Date.now()
        })
      });
      if (!res.ok) {
        setStatus("Send failed " + res.status, true);
        return;
      }
      els.messageInput.value = "";
      await refresh();
    });

    els.conversationInput.value = state.selectedId;
    void refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;
}

// 验证签名
function verifySignature(req: Request): boolean {
  if (!WEBHOOK_SECRET) return true;
  const header = req.headers.get("x-zlx-webhook-secret") ?? "";
  return safeEqualSecret(header, WEBHOOK_SECRET);
}

// GET / - 健康检查
app.get("/", (c) => c.json({ ok: true, channel: "zlx", version: "0.1.0" }));

// GET /health - 健康检查
app.get("/health", (c) => c.json({ status: "ok" }));

// GET /ui - 对话调试页面
app.get("/ui", (c) => c.html(renderConversationPage()));

// GET /api/conversations - 获取会话列表
app.get("/api/conversations", (c) => {
  const conversations = [...conversationStore.values()]
    .map((conversation) => ({
      ...conversation,
      messageCount: getConversationMessages(conversation.id).length,
    }))
    .sort((left, right) => right.lastMessageAt - left.lastMessageAt);
  return c.json({ conversations });
});

// POST /webhook - 接收消息
app.post("/webhook", async (c) => {
  if (!verifySignature(c.req.raw)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = await c.req.json() as {
    id?: string;
    text?: string;
    senderId?: string;
    senderName?: string;
    conversation?: { id: string; kind?: string; title?: string };
    timestamp?: number;
    threadId?: string;
    replyToId?: string;
  };

  if (!body.text || !body.conversation?.id) {
    return c.json({ error: "invalid payload" }, 400);
  }

  const message = {
    id: body.id ?? `msg-${Date.now()}`,
    text: body.text,
    senderId: body.senderId ?? "unknown",
    senderName: body.senderName,
    timestamp: body.timestamp ?? Date.now(),
    direction: "inbound" as const,
    threadId: body.threadId,
    replyToId: body.replyToId,
  };

  getConversationMessages(body.conversation.id).push(message);
  upsertConversation({
    id: body.conversation.id,
    kind: body.conversation.kind === "channel" ? "channel" : "direct",
    title: body.conversation.title,
    timestamp: message.timestamp,
  });

  // 构造符合 zlx-channel 格式的消息
  const zlxMessage = {
    id: message.id,
    text: message.text,
    senderId: message.senderId,
    senderName: body.senderName ?? message.senderId,
    conversation: {
      id: body.conversation.id,
      kind: (body.conversation.kind === "channel" ? "channel" : "direct") as "direct" | "channel",
      title: body.conversation.title,
    },
    timestamp: message.timestamp,
    threadId: body.threadId,
    replyToId: body.replyToId,
  };

  if (OPENCLAW_WEBHOOK_URL) {
    const response = await fetch(OPENCLAW_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WEBHOOK_SECRET ? { "X-Zlx-Webhook-Secret": WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ message: zlxMessage }),
    });
    if (!response.ok) {
      return c.json(
        {
          error: "openclaw webhook failed",
          status: response.status,
          body: await response.text().catch(() => ""),
        },
        502,
      );
    }
  }

  return c.json({ ok: true, messageId: message.id });
});

// GET /messages/:conversationId - 获取会话消息
app.get("/messages/:conversationId", (c) => {
  const conversationId = c.req.param("conversationId");
  const messages = getConversationMessages(conversationId);
  return c.json({ messages });
});

// POST /send - 发送消息（模拟发送回复）
app.post("/send", async (c) => {
  const body = await c.req.json() as {
    target?: string;
    text?: string;
    senderId?: string;
    senderName?: string;
  };

  console.log('body--->', body);

  if (!body.target || !body.text) {
    return c.json({ error: "missing target or text" }, 400);
  }

  const messageId = `sent-${Date.now()}`;
  const conversationId = body.target.replace(/^(dm:|channel:)/, "");

  getConversationMessages(conversationId).push({
    id: messageId,
    text: body.text,
    senderId: body.senderId ?? "bot",
    senderName: body.senderName,
    timestamp: Date.now(),
    direction: "outbound",
  });
  upsertConversation({
    id: conversationId,
    timestamp: Date.now(),
  });

  return c.json({ ok: true, messageId, conversationId });
});

console.log(`zlx-channel server starting on port ${PORT}...`);
console.log(`Webhook secret: ${WEBHOOK_SECRET ? "configured" : "not set"}`);
console.log(`Outbound URL: ${OUTBOUND_URL || "not set"}`);
console.log(`OpenClaw webhook URL: ${OPENCLAW_WEBHOOK_URL || "not set"}`);

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`zlx-channel server running at http://localhost:${PORT}`);
console.log(`Webhook endpoint: POST http://localhost:${PORT}/webhook`);
