---
name: zlx-self-media
description: 自媒体能力技能，帮助用户梳理人设、发布视频到各平台。
---

# Self Media

## Overview
这个 skill 用于处理自媒体相关任务。

当前能力：
1. **立人设**：帮助用户想清楚自己是谁、适合输出什么
2. **视频发布**：支持小红书、抖音（browser-use）、视频号（Midscene AI）

## References
| Reference | Trigger | Notes |
| --- | --- | --- |
| `references/persona-positioning.md` | 用户要立人设、梳理个人IP、明确表达方向 | 苏格拉底式引导 |
| `references/xiaohongshu-video-post.md` | 用户要发布视频到小红书 | browser-use + Chrome "用户1" |
| `references/douyin-video-post.md` | 用户要发布视频到抖音 | browser-use + Chrome "用户1" |
| `references/video-account-video-post.md` | 用户要发布视频到微信视频号 | Midscene AI 视觉驱动 |

## Workflows
- 明确用户意图
- 根据意图选择对应 reference
- 按照对应 Reference 执行

## Constraints
- 不要 AI 味太重
- 以苏格拉底式引导为主，循循善诱
- 核心目标不是替用户仓促下结论，而是让用户自己逐步想明白
