# Skills

本目录只放 Agent 的判断规则、工作流程、参考资料和输出模板。可执行代码统一维护在项目根目录 `cmd/`，由 `zlx-cli` 调用。

## 当前 Skills

| Skill | 职责 |
| --- | --- |
| `zlx-note` | 本地资料归档、索引、回查与 Get 笔记同步判断 |
| `zlx-self-media` | 自媒体选题、写作、标题与跨平台内容规划 |
| `zlx-video-cut` | 口播视频剪辑、字幕校对与成片检查，调用 `zlx-cli video` |
| `zlx-wechat-article` | 公众号文章排版、配图与草稿流程，调用 `zlx-cli wechat` |
| `zlx-getnote` | Get 笔记保存、搜索和知识库管理，调用 `zlx-cli getnote` |

普通文档读取直接使用 `zlx-cli doc read`。旧 Skill 的资料暂存于 `docs/archived-skills/`，用于核对迁移前的说明。

## 链接到 Agent

```bash
zlx-cli skill link zlx-note codex
zlx-cli skill link zlx-note claude,openclaw
zlx-cli skill unlink zlx-note codex
```

链接命令只处理软链接；目标位置已有普通文件、目录或指向其他位置的软链接时会跳过。命令源码位于 `cmd/business/skill/`。
