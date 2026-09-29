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
