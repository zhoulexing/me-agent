# pi-agent

基于 [`earendil-works/pi`](https://github.com/earendil-works/pi) 的轻量本地 Codex agent。

这个目录不保存 API key。启动时会优先读取 `.env` / 环境变量；如果没有配置，会自动复用 `~/.codex/config.toml` 里的 `env_key` 和 `model`。随后生成临时的 `.pi-agent-runtime/models.json`，并通过 Pi 的 `@earendil-works/pi-coding-agent` SDK 创建 agent session。

## 使用

```bash
cd /Users/zhouyuexing/.openclaw/workspace/me-agent/07-agent/pi-agent
npm install
```

如果你已经在 Codex 里配置过 `env_key`，可以直接运行：

```bash
npm run dev -- "看一下当前目录有哪些文件"
```

不传 prompt 时会进入简单 REPL：

```bash
npm run dev
```

## 配置

默认值：

- `CODEX_BASE_URL`：默认 `https://api.openai.com/v1`
- `CODEX_API_KEY`：默认读取 `~/.codex/config.toml` 的 `env_key`
- `CODEX_MODEL`：默认读取 `~/.codex/config.toml` 的 `model`

接本地代理或本地 OpenAI-compatible 服务时，可以复制 `.env.example`：

```bash
cp .env.example .env
```

常用配置：

- `CODEX_BASE_URL`：你的本地 Codex/OpenAI-compatible 服务地址，例如 `http://127.0.0.1:8080/v1`
- `CODEX_API_KEY`：服务 API key
- `CODEX_API`：默认 `openai-responses`。如果你的服务明确兼容 Codex Responses，可改为 `openai-codex-responses`
- `PI_AGENT_CWD`：agent 工具操作目录，默认是本目录
- `PI_AGENT_TOOLS`：工具白名单，默认 `read,grep,find,ls,bash,edit,write`

## 说明

Pi 内置的 `openai-codex` provider 主要面向 ChatGPT/Codex OAuth。这里按“本地服务 + API key”的形态实现为自定义 provider，更适合接本地网关、代理服务或 OpenAI-compatible endpoint。
