# Skills 清单

> 记录所有已安装/常用的技能，按类目分类

---

## 编码

### obra/superpowers@using-superpowers

- **作用**：辅助写代码
- **安装**：`npx skills add obra/superpowers@using-superpowers -g -a claude-code -a codex`

---

## 生图

### baoyu-infographic

- **作用**：将内容转换为信息图表（Infographic）
- **安装**：`npx skills add jimliu/baoyu-infographic -g`

### baoyu-cover-image

- **作用**：分析文章内容，自动选择视觉尺寸，接受参考图片，生成封面图
- **安装**：`npx skills add jimliu/baoyu-cover-image -g`

### baoyu-article-illustrator

- **作用**：分析文章内容，确定插图位置，批量生成文章插图
- **安装**：`npx skills add jimliu/baoyu-article-illustrator -g`

### baoyu-slide-deck

- **作用**：将内容转换为专业幻灯片图片，支持多种视觉风格（blueprint、chalkboard、corporate、minimal、sketch-notes 等），可合并为 PPTX/PDF
- **安装**：`npx skills add jimliu/baoyu-skills -s baoyu-slide-deck -g -y`
- **核心用法**：`/baoyu-slide-deck path/to/content.md --style sketch-notes --audience executives --lang zh --slides 10`
- **输出**：幻灯片图片 + outline.md + prompts 目录 + 可选 PPTX/PDF
- **适用场景**：创建演示文稿、PPT、图片版幻灯片，适合用于分享和阅读而非现场演讲
- **Style 预设**：blueprint（默认）、chalkboard、corporate、minimal、sketch-notes、hand-drawn-edu、watercolor、dark-atmospheric、notion、bold-editorial、editorial-infographic、fantasy-animation、intuition-machine、pixel-art、scientific、vector-illustration、vintage

---

## PPT / 幻灯片

> 资料检索时间：2026-06-30。主要依据各项目 GitHub README / SKILL.md。

### ppt-master

- **来源**：https://github.com/hugohe3/ppt-master
- **Skill 名称**：`ppt-master`
- **定位**：AI 驱动的多格式 PPT 生成工作流，把 PDF / DOCX / URL / Markdown / PPTX 等源材料转成 SVG 页面，再导出为原生可编辑 `.pptx`。
- **安装**：`npx skills add hugohe3/ppt-master`；仍需要 Python 3.10+，并在安装位置执行 `pip install -r requirements.txt`。
- **核心用法**：把源文件放进项目目录后，让 Agent 执行类似 `Please create a PPT from projects/q3-report/sources/report.pdf` 的任务。
- **输出**：原生 PowerPoint 文件，元素是可点击编辑的 DrawingML 形状 / 文本框 / 图表，不是整页图片；同时保留 `svg_output/` 快照，支持重导出。
- **能力点**：严格串行 pipeline；支持源材料转换、项目初始化、设计确认、图像生成 / 搜图、SVG 质量检查、PPTX 导出、演讲备注、音频旁白、已有 PPTX 模板填充和美化路线。
- **适用场景**：需要最终交付可继续编辑的正式 PPTX；文档、报告、研究资料、教学材料转 PPT；已有 PPT 模板或旧 PPT 需要复用 / 美化。
- **注意**：工作流重，强依赖 Agent 严格执行 `SKILL.md`；不是“一句话一次性完美出片”的工具。高质量输出依赖强模型、图片能力和人工审美复核。

### html-ppt-skill

- **来源**：https://github.com/lewislulu/html-ppt-skill
- **Skill 名称**：`html-ppt`
- **定位**：HTML PPT Studio，用静态 HTML / CSS / JS 生成专业演示文稿，主打模板、主题、布局和动画库。
- **安装**：`npx skills add https://github.com/lewislulu/html-ppt-skill`
- **核心用法**：围绕主题、受众、页数和风格选模板；可用 `./scripts/new-deck.sh my-talk` scaffold，再从 `templates/` 和 `references/` 中选主题、布局、动画。
- **输出**：纯静态 HTML deck，可浏览器演示；可用 Headless Chrome 脚本渲染 PNG。默认不是原生可编辑 PPTX。
- **能力点**：36 个主题、15 个 full-deck templates、31 个单页布局、27 个 CSS 动画、20 个 canvas FX；内置键盘导航、主题切换、overview、逐字稿 / 演讲者模式。
- **适用场景**：技术分享、pitch deck、课程、周报、小红书图文、需要浏览器播放和动效的静态演示；尤其适合需要 presenter mode 和逐字稿的演讲。
- **注意**：生成前需要先确认内容 / 受众、主题、起始模板；应从已有模板和 token 设计系统出发，不宜从零写页面或随意发明布局。

### guizang-ppt-skill

- **来源**：https://github.com/op7418/guizang-ppt-skill
- **Skill 名称**：`guizang-ppt-skill`
- **定位**：网页 PPT / 配图 / 封面 Skill，生成单文件 HTML 横向翻页 PPT，并覆盖 PPT 配图和多平台封面。
- **安装**：`npx skills add https://github.com/op7418/guizang-ppt-skill --skill guizang-ppt-skill`
- **核心用法**：先选择 Style A「电子杂志 × 电子墨水」或 Style B「瑞士国际主义」，再按 7 问清单确认受众、时长、素材、图片 / 截图需求、主题色和硬约束。
- **输出**：单文件 HTML 横向翻页 deck；可浏览器直接打开、截图或录屏。PPTX 不是当前主流程。
- **能力点**：Style A 有 10 种杂志风布局；Style B 有 22 种锁定瑞士版式；支持 WebGL / canvas 动效、低性能静态模式、主题色预设、Codex 可选配图流程、公众号 / 小红书 / 视频号封面规格。
- **适用场景**：线下分享、行业内部讲话、私享会、AI 产品发布、demo day、强个人风格演讲；长文章变 6-10 页观点 deck；产品分析 / 方法论用瑞士风。
- **不适合**：大段表格数据、培训课件、多人协作编辑、必须交付原生可编辑 PPTX 的场景。
- **注意**：Style B 约束很强，需要使用 `S01-S22` 锁定版式并运行 `node scripts/validate-swiss-deck.mjs path/to/index.html`；颜色只能从预设主题选，不建议自定义 hex。

### 选择建议

- **要可编辑 PPTX**：优先 `ppt-master`。
- **要模板丰富、浏览器演示、演讲者模式**：优先 `html-ppt-skill`。
- **要强风格的杂志风 / 瑞士风网页 PPT 或封面联动**：优先 `guizang-ppt-skill`。

---

## 视频 / 剪辑

> 资料检索时间：2026-06-30。主要依据项目 GitHub README / install.md / SKILL.md。

### video-use

- **来源**：https://github.com/browser-use/video-use
- **Skill 名称**：`video-use`
- **定位**：对话式视频剪辑 Skill。把原始素材放进一个目录后，通过 Agent 对话完成转写、粗剪、精剪、调色、字幕、动画叠加、自检和最终导出。
- **安装**：推荐让 Agent 先读 `install.md`，克隆 `https://github.com/browser-use/video-use` 到稳定目录（如 `~/Developer/video-use`），再把整个目录软链到当前 Agent 的 skills 目录；手动示例：`ln -sfn ~/Developer/video-use ~/.codex/skills/video-use`。
- **依赖**：Python 3.10+；Python 包包括 `requests`、`librosa`、`matplotlib`、`pillow`、`numpy`；`ffmpeg` / `ffprobe` 是硬要求；`yt-dlp` 可选；ElevenLabs API key 用于 Scribe 转写；HyperFrames / Remotion / Manim 按动画需求懒安装。
- **核心用法**：进入素材目录后启动 Agent，说类似 `edit these into a launch video` 或 `inventory these takes and propose a strategy`；所有输出写入素材目录下的 `edit/`，不污染 skill 仓库。
- **输出**：`edit/preview.mp4`、`edit/final.mp4`；同时保留 `project.md`、`takes_packed.md`、`edl.json`、`transcripts/`、`master.srt`、`animations/`、`verify/` 等过程资产。
- **能力点**：基于 ElevenLabs Scribe 的逐词时间戳转写；把多个 take 打包成 `takes_packed.md` 供 LLM 阅读；按词边界和静音点做剪辑；去 filler、false start、死空白；每段独立抽取、调色、30ms 音频淡入淡出；可烧字幕；可用 HyperFrames / Remotion / Manim / PIL 生成动画 overlay；成片前用 `timeline_view` 对切点做自检。
- **工作流**：先 inventory / 转写 / 打包 transcript，再根据素材向用户提问；用 4-8 句话提出剪辑策略并等待确认；确认后生成 EDL、渲染 preview、自检、迭代，最后导出 final 并追加 `project.md` 记忆。
- **适用场景**：talking head、产品发布、教程、采访、多 take 口播、旅行 / 活动 montage、需要字幕和轻动画的内容；尤其适合“有一堆素材，希望 Agent 帮我先理解再剪”的任务。
- **不适合**：没有可执行环境 / 没有 ffmpeg 的纯聊天环境；没有 ElevenLabs key 时无法完成核心转写；需要传统非线编软件中多人协作、复杂人工调音调色的专业后期项目。
- **硬规则摘要**：字幕必须最后进 filter chain；剪辑边界不能切进单词；切点要按逐词时间戳加 30-200ms padding；每个 segment 边界要 30ms audio fade；overlay 必须用 `setpts=PTS-STARTPTS+T/TB` 对齐窗口；master SRT 用输出时间线偏移；策略确认前不能动剪辑。
- **注意**：它不是“固定模板视频生成器”，而是把 Agent 变成有工具链的剪辑助理。生产正确性规则很硬，但风格、节奏、调色、字幕样式和动画方案应根据素材与用户目标判断。

---

### HyperFrames by HeyGen

- **来源**：https://github.com/heygen-com/hyperframes
- **文档**：https://hyperframes.heygen.com/packages/cli
- **npm 包**：`hyperframes@0.7.22`，未加 scope，不是 `@heygen/hyperframes`
- **定位**：HTML 视频合成 CLI。用 HTML/CSS/JS 编写 video composition，再通过 CLI 预览、检查和渲染成 MP4 或透明 WebM。官方描述是 `Create, preview, and render HTML video compositions from the command line`，项目口号是 `Write HTML. Render video. Built for agents.`
- **依赖**：Node.js >= 22；FFmpeg；渲染和预览依赖 Chrome/Chromium 环境。
- **安装 / 运行**：可 `npm install -g hyperframes` 全局安装，也可 `npx hyperframes <command>` 临时运行。
- **核心命令**：`init` 创建 composition 项目；`preview` 启动浏览器预览；`lint` 检查 HTML composition；`inspect` 检查文本溢出、裁切、重叠和运动意图；`snapshot` 导出关键帧；`render` 渲染 MP4 / WebM；`capture` 抓取网站素材；`transcribe` 转写或导入字幕；`tts` 生成语音；`remove-background` 生成透明主体素材；`doctor` 检查本机依赖。
- **和 video-use 的关系**：`video-use` 负责口播视频的转写、初剪、字幕、音频和最终合成；HyperFrames 负责复杂动态图文片段，例如标题动画、章节卡、重点词高亮、网页 / 产品 UI 动效、数据状态变化、透明 WebM overlay。
- **典型流程**：在 `edit/animations/slot_<id>/` 内初始化 HyperFrames 项目；用 HTML/CSS/GSAP 写动态图文；跑 `lint`、`inspect`、`snapshot` 或预览检查；渲染为 `render.mp4` 或 `render.webm`；再由 `video-use` / ffmpeg 作为 overlay 合成进主视频。
- **适合场景**：3-6 张精致章节卡；字幕以外的重点词逐个高亮；产品界面、网页界面、代码窗口、数据面板的动画演示；需要 Codex 用可检查的 HTML 工程方式生产视频片段；需要透明 WebM 叠加到原始视频。
- **不适合场景**：只是烧录字幕；只是静态 PNG 信息卡；只是简单裁剪、降噪、音量规范化；没有明确视觉结构，只是为了“更高级”而引入复杂动效。
- **初步判断**：HyperFrames 的关键价值不是替代剪辑软件，而是把视频包装中的动态图文部分变成可代码化、可检查、可复用的网页工程。它和 Codex 的组合点很明确：Codex 擅长读写 HTML/CSS/JS、跑检查、抽帧验证、修复溢出和重叠，因此 HyperFrames 很适合作为短视频中场动画和解释型卡片的底层能力。
- **待验证**：本机直接运行 `npx --yes hyperframes --help` 时遇到 npm 网络解析失败，未完成本地 CLI 帮助验证。后续实际使用前先跑：`npx hyperframes doctor`、`npx hyperframes init demo --example blank --non-interactive --skip-skills`、`npx hyperframes lint`、`npx hyperframes render --output output.mp4`。

---
