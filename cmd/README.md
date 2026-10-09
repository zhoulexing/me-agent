# zlx-cli

`cmd/cli.js` 是对外入口；根目录 `package.json` 将全局命令 `zlx-cli` 指向该文件。Node.js 18+ 可运行，现有文档和视频命令仍调用迁入 `cmd/` 的 Python、Bash 工具。

## 目录

```text
cmd/
├── cli.js       命令分发
├── auth/        凭证配置状态与公共授权能力
├── platforms/   Get 笔记、公众号、ARK 等外部平台
├── business/    本地记录、文档、视频、排版和 Skill 链接
└── tests/       离线命令测试
```

依赖方向为 Skills → `zlx-cli` → business → platforms → auth。平台对接可以直接提供只读命令；业务命令负责组合本地文件和平台能力。凭证不写入 Skill 目录。

## 配置

CLI 固定读取当前 `me-agent` 项目根目录的 `.config/`，不受运行命令时的工作目录影响。配置文件权限设为 `600`，整个 `.config/` 已被 Git 忽略：

```text
.config/
├── getnote.json   {"apiKey":"...","clientId":"..."}
├── wechat.json    {"appId":"...","appSecret":"..."}
├── ark.json       {"apiKey":"..."}
└── zlx-cli.json   {"python":"...","documentPython":"..."}（可选）
```

`zlx-cli auth status` 仅显示是否配置，不输出密钥。`zlx-cli doc setup` 会将找到的文档解释器写入 `zlx-cli.json`。项目内 `.zlx-cli/` 只存放运行产物。

## 安装与检查

```bash
npm link --ignore-scripts
zlx-cli --help
zlx-cli auth status
npm test
```

## 常用命令

```bash
zlx-cli record search "寄件"
zlx-cli record sync --source getnote --dry-run
zlx-cli record sync --source all
zlx-cli record add --title "寄件事项" --type 待办 --tags "生活,寄件" \
  --summary "明天寄出包裹" --content-file /tmp/record.txt --dry-run
zlx-cli doc read README.md --format markdown
zlx-cli video prepare /absolute/path/source.mov
zlx-cli wechat compose --input source.md --plan layout.json --output article.html
zlx-cli wechat draft --title "文章标题" --html-file article.html \
  --cover-image images/cover.png --dry-run
zlx-cli wechat read-published \
  --url 'https://mp.weixin.qq.com/s/3i3BOJnuMVSFoOxsSNY5og' \
  --title 'DeepSeek Harness v0.1.6-alpha.1 主要更新一览' \
  --output /tmp/wechat-official-article.json
zlx-cli getnote request GET '/open/api/v1/resource/knowledge/list?page=1'
```

Get 笔记请求体使用 UTF-8 JSON 文件，避免大整数笔记 ID 被 JavaScript 重新序列化。会修改 Get 笔记的请求先用 `--dry-run` 检查，再在用户授权后使用 `--execute`。公众号草稿也先用 `--dry-run` 预览；创建或更新草稿是单独的外部写入。本文命令不会自行发起远端同步或发布。

`wechat read-published` 只调用当前配置账号的官方已发布列表与详情接口，不会抓取目标 URL。短链接与接口 URL 不一致时，`--title` 可用于定位候选；输出的 `matchedBy: title-only` 不表示已验证两个链接相同。接口可能受账号权限和出口 IP 白名单限制。

## 来源原文同步

`record sync` 单向读取来源，按创建日期写入 `03-信息记录`，同步维护索引。配置为 `.config/source-sync.json`：`version: 1`、`timezone: "Asia/Shanghai"`、`startDate: "2026-10-07"`、`sources: ["getnote"]`。首次范围固定从配置日期开始；成功进度保存后沿用该起点。不会修改远端笔记或启用任何定时器。

日期记录只展示原标题、指定来源元数据、存在时的源网页链接和 Get 正文（仅 `content`，原样保留），不展示其他来源字段、附件清单或原始响应链接，不新增分析或选题。完整响应保存在 `outputs/信息同步/<来源>/<ID>/<版本指纹>/` 作为内部存档；不再下载附件，已有存档保留。进度、运行锁与中断恢复暂存位于 `.zlx-cli/source-sync/`。展示版本升级会迁移已有来源区块一次；无新增、修改或待迁移格式时不改信息记录。重复执行不追加副本，源头修改只更新自己的来源区块并保留旧快照，本地手写内容保留。若来源区块被手改则停止并报告冲突。

平台代码位于 `cmd/platforms/getnote/source.js`；业务写入、索引与恢复位于 `cmd/business/source-sync.js`。当前只实现 Get，新增来源应提供列表、详情、附件读取和身份标识，并明确配置范围。更多规则见 `skills/zlx-note/references/source-sync.md`。
