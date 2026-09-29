---
name: zlx-self-media
description: 为周某人的自媒体做选题研究、内容结构、文章与口播稿写作，以及标题优化。用于内容创作阶段，不负责剪辑或平台发布操作。
---

# 自媒体内容创作

本 Skill 负责选题和表达判断。已有观点稿保存到 `02-内容创作/`；外部资料、灵感和待研究线索先按 `zlx-note` 的规则写入 `03-信息记录/`，不要提前当作用户观点。

## 按任务读取参考资料

| 任务 | 参考资料 |
| --- | --- |
| 确定创作方向和受众 | [persona-positioning.md](references/persona-positioning.md) |
| 研究选题 | [topic-research.md](references/topic-research.md) |
| 设计结构、写文章或口播稿 | [writing-principles.md](references/writing-principles.md) |
| 起标题或优化标题 | [title-principles.md](references/title-principles.md) |

选题涉及近期平台趋势时联网核对具体来源和日期，再判断讨论价值。写作时区分用户已有判断、外部引用和仍需核验的推断；保留用户已认可的表达，避免泛泛套模板。

## 后续流程

- 用户要剪辑口播视频时，使用 `zlx-video-cut`，其可执行步骤走 `zlx-cli video`。
- 用户要排版、配图或创建公众号草稿时，使用 `zlx-wechat-article`，其可执行步骤走 `zlx-cli wechat`。
- 小红书、抖音的旧浏览器发布说明暂存于 `docs/platforms/`，待对应平台接入 CLI 后再恢复为独立平台流程。
