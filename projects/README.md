# 浏览器 Agent 与 Harness 源码实验区

下列源码目录按独立 Git 仓库维护。新增的本地重建工程通过 `projects/.gitignore` 保留自己的仓库边界。

| 目录 | 来源 | 克隆时的 commit | 用途 |
| --- | --- | --- | --- |
| `jev-ultrafast/` | <https://github.com/browser-use/jev-ultrafast> | `1231850a0bf1a0c0341fe408ef1668dbbfdfac46` | Jev 驱动的浏览器 Agent，当前实验对象 |
| `deepseek-harness/` | <https://github.com/deepseek-ai/deepseek-harness> | `46a7f68b0922371ce7144b668b90e377d8e799f4` | DeepSeek Harness 官方源码 |
| `claude-code/` | 本机 `/Users/zhouyuexing/project/github/claude-code` 的本地 Git 克隆 | `d079cf8042d6c20184a3a0693047a7987d2abaae` | 第三方 Claude Code 源码快照，仅供本地研究；不是 Anthropic 官方完整源码仓库 |
| `codex-harness/` | 本机 `/Users/zhouyuexing/project/github/codex` 的本地 Git 克隆；其上游为 <https://github.com/openai/codex> | `63d213884daea50e4f74efc192cdc44f549b67d5` | Codex 源码；本次没有验证它与上游最新提交一致 |
| [codex-rebuild/](./codex-rebuild/README.md) | 本地自建；REA 6.4.0 分析已安装 Codex 26.1007.30912 | 初始工程，尚未创建提交 | REA 原始证据、协议恢复与可运行 Electron 重建原型；执行内核复用本机 Codex CLI |

本地 Git 克隆只包含源仓库**已提交**的文件，不包含原目录中的未跟踪研究笔记。`claude-code/` 和 `codex-harness/` 的 `origin` 指向各自的本机源仓库；另外两个项目的 `origin` 指向表中的 GitHub 仓库。

自建工程：[Agent Harness](./agent-harness/README.md) 从最小 CLI 骨架开始，按课程逐步实现。

## 运行 Jev Ultrafast

需要 Python 3.12+、`uv`、本机 Chrome，以及 TypeSafe 的 API key。需要向网页输入生成的文字时，还需要一个兼容 OpenAI API 的文本模型 key。

```bash
cd projects/jev-ultrafast
uv sync
uv run pytest -q
uv run browser-harness --doctor
uv run jev
```

在浏览器打开 <http://127.0.0.1:8766>。第一次连接 Chrome 时，需要在 `chrome://inspect/#remote-debugging` 手动允许远程调试。启动演示前，先在被 Git 忽略的 `jev-ultrafast/.env` 中填写 `TYPESAFE_API_KEY`；若任务需要输入文字，还需填写 `TEXT_MODEL_API_KEY`。修改 `.env` 后重启演示服务。不要把 key 写入此 README 或提交到 Git。

建议先在演示界面使用 **Choose next** 逐步观察，而不是直接自动执行。`DONE` 仅是 Agent 的选择，任务是否完成仍需独立检查实际网页状态。当前项目创建自己的后台标签页，不直接接管当前活动标签页。
