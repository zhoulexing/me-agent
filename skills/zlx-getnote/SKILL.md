---
name: zlx-getnote
description: 在 Get 笔记中保存、搜索、查看或管理笔记与知识库。用于用户明确要求操作 Get 笔记时；本地信息记录由 zlx-note 处理。
---

# Get 笔记

本 Skill 负责选择操作、核对目标和解释结果。所有 Get 笔记 API 调用经由 `zlx-cli getnote`；不要从 Skill 目录执行脚本，也不要直接拼接 HTTP 请求。`zlx-cli auth status` 可检查项目 `.config/getnote.json` 是否配置 API Key。

## 按任务读取参考资料

| 任务 | 参考资料 |
| --- | --- |
| 保存文本、链接、图片 | [save.md](references/save.md) |
| 语义搜索 | [search.md](references/search.md) |
| 列表、详情、修改与删除 | [list.md](references/list.md) |
| 知识库操作 | [knowledge.md](references/knowledge.md) |
| 标签操作 | [tags.md](references/tags.md) |
| 设备授权 | [oauth.md](references/oauth.md) |
| 字段与错误码 | [api-details.md](references/api-details.md) |

## 命令方式

请求体先保存为 UTF-8 JSON 文件，然后传入完整的资源 API 路径。CLI 固定使用 Get 笔记的 OpenAPI 域名，并原样传输 JSON，避免 64 位笔记 ID 丢失精度。

```bash
zlx-cli getnote request POST /open/api/v1/resource/recall --body-file /tmp/getnote-query.json
zlx-cli getnote request GET '/open/api/v1/resource/note/detail?id=<note_id>'
zlx-cli getnote request POST /open/api/v1/resource/note/save --body-file /tmp/getnote-save.json --dry-run
zlx-cli getnote request POST /open/api/v1/resource/note/save --body-file /tmp/getnote-save.json --execute
zlx-cli getnote image upload /absolute/path/image.jpg
zlx-cli getnote oauth device
zlx-cli getnote oauth poll '<code>'
```

写操作先预览请求，并按用户明确的目标与范围执行。返回 `success: false` 时报告错误；不能凭命令退出或任务受理就声称笔记已完成。链接和图片保存若返回 `task_id`，继续查询 `/note/task/progress`，以 `success` 或 `failed` 为准。涉及本地目录与 Get 知识库同步时，先读 `zlx-note/references/getnote.md` 中的逐条映射；不按本地目录名猜目标知识库。

若项目 `.config/getnote.json` 配置了 `ownerId`，先核对请求者身份。笔记 ID、任务 ID、知识库 ID 都以实际 API 响应为准；内链与公开分享链接按用户意图区分。
