# Agent Harness

从零到一构建 Agent Harness 的工程实验区。整体边界见 [工程结构](../../05-主题资料/Agent工程/工程结构.md)。

## 当前进度

已建立 pnpm 工作区和 CLI 入口。当前 CLI 只提供帮助信息；Agent Loop、工具执行和 JSON-RPC Server 将随课程逐步实现。

```sh
pnpm cli --help
```

`apps/` 放可执行入口，`packages/` 放可复用能力。具体包在实现对应能力时创建，不预置插件框架或空包。
