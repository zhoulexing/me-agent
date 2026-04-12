# 微信视频号视频发布 - Midscene AI 视觉驱动方案

## 功能
使用 **Midscene** AI 视觉驱动方案发布视频到微信视频号。

## 为什么用 Midscene？
视频号使用 wujie-app + shadow DOM 技术，传统的 DOM 操作（如 browser-use）无法访问 shadow DOM 内的元素。

Midscene 通过 AI 分析截图来理解页面，**不依赖 DOM 结构**，可以天然绕过 shadow DOM、iframe 等技术限制。

## 使用方式
```bash
node publish-video.js <video_path> [title] [--headed]

# 示例
node publish-video.js "/path/to/video.mp4" "AI时代，我在达芬奇里打字"
node publish-video.js "/path/to/video.mp4" "标题" --headed
```

## 参数说明
| 参数 | 说明 |
|------|------|
| `video_path` | 视频文件路径（必填） |
| `title` | 视频标题（可选，不填只用固定标签） |
| `--headed` | 兼容保留参数，当前脚本固定连接真实 Chrome |

## 默认行为
- **固定标签**：`#人工智能 #视频日记`
- **标题处理**：视频号没有单独标题，标题直接拼接到描述中，格式为 `[标题] [标签]`
- **确认**：发布前截图给用户确认，用户输入 y 确认发布

## 工作流程
```
1. 连接已启动的真实用户 Chrome
2. Midscene AI 分析截图，找到"发表视频"按钮
3. AI 自动点击 → 上传视频 → 填写描述
4. 截图确认 → 用户输入 y/n → 完成发布
```

## 配置步骤

### 1. 关键限制

从 **Chrome 136** 开始，官方不再允许对默认用户目录直接启用 `--remote-debugging-port` / `--remote-debugging-pipe`。

这意味着：
- 想复用“真实用户已登录的 Chrome profile”时，`connectOverCDP` 方案通常会失效
- 进程参数里即使带了 `--remote-debugging-port=9222`，端口也可能根本不会监听
- 因此“真实用户身份 + Playwright/Midscene attach”这条路在新版本 Chrome 上不可靠

补充：
- Chrome 界面里看到的“用户1”通常只是显示名，真实 profile 目录往往是 `Default`、`Profile 1` 这种名字
- 当前仓库这台机器上，“用户1”对应的真实目录是 `Default`

### 2. 配置 .env 文件

.env 文件已在 `scripts/.env`，包含 Doubao API 配置：
```env
MIDSCENE_MODEL_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
MIDSCENE_MODEL_API_KEY="your-api-key"
MIDSCENE_MODEL_NAME="doubao-seed-2-0-lite-260215"
MIDSCENE_MODEL_FAMILY="doubao-seed"
```

### 3. 推荐方向

如果必须满足“真实用户身份 + 视觉操作”：
- 不要再依赖 CDP attach
- 改用 macOS 系统级 GUI 自动化，例如 AppleScript / Accessibility / `cliclick`
- Midscene 可以继续负责视觉理解，但点击和输入应通过系统级能力执行

## Midscene 核心 API

```javascript
const { PlaywrightAgent } = require('@midscene/web/playwright');

// 初始化 Agent
const agent = new PlaywrightAgent(page);

// AI 自动规划和执行操作
await agent.aiAct('点击"发表视频"按钮');

// AI 查询页面内容
const content = await agent.aiQuery(page, '页面上有什么按钮？');

// AI 断言
await agent.aiAssert('页面上显示了"发布成功"');
```

## 注意事项
1. **当前限制不是脚本 bug**：而是新版 Chrome 的安全策略限制了默认 profile 上的 remote debugging
2. **网络**：需要能访问 Doubao API
3. **成本**：相比 browser-use，AI 视觉调用有一定成本
4. **速度**：比 DOM 操作慢（每次要等 AI 分析），但更稳定

## 参考资料
- Midscene 官网: https://midscenejs.com/
- 模型配置: https://midscenejs.com/zh/model-common-config
