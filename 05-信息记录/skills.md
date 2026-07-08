# Skills 清单

> 记录已安装或常用的 Skill / MCP，按用途分类。

---

## 编码 / Agent 能力

### obra/superpowers@using-superpowers

- **类型**：skill
- **来源**：https://github.com/obra/superpowers
- **安装**：`npx skills add obra/superpowers@using-superpowers -g -a claude-code -a codex`
- **作用**：为编码 Agent 提供通用工作方法、上下文管理和协作规范。
- **核心用法**：在支持 skills 的 Agent 中自动加载，用于指导代码阅读、实现、验证和交付流程。
- **适用场景**：日常编码、代码修改、调试、重构、需要更稳定 Agent 工作流的任务。

---

## 生图 / 视觉内容

### baoyu-infographic

- **类型**：skill
- **来源**：https://github.com/jimliu/baoyu-infographic
- **安装**：`npx skills add jimliu/baoyu-infographic -g`
- **作用**：将文字内容整理并生成信息图表。
- **核心用法**：给定主题、资料或结构化内容，让 Agent 选择合适的信息图版式和视觉风格后生成图片。
- **适用场景**：知识总结、数据解读、文章配图、社媒长图、方法论可视化。

### baoyu-cover-image

- **类型**：skill
- **来源**：https://github.com/jimliu/baoyu-cover-image
- **安装**：`npx skills add jimliu/baoyu-cover-image -g`
- **作用**：根据文章或主题生成封面图，支持参考图片和自动尺寸判断。
- **核心用法**：输入文章内容、标题、平台或封面尺寸要求，由 Agent 生成封面方案和图片。
- **适用场景**：公众号封面、小红书封面、博客头图、视频封面、文章视觉包装。

### baoyu-article-illustrator

- **类型**：skill
- **来源**：https://github.com/jimliu/baoyu-article-illustrator
- **安装**：`npx skills add jimliu/baoyu-article-illustrator -g`
- **作用**：分析文章内容，确定插图位置并批量生成文章插图。
- **核心用法**：输入文章或 Markdown，让 Agent 拆分段落、判断插图点、生成统一风格插图。
- **适用场景**：长文配图、教程插图、专栏文章视觉增强、内容发布前的图文包装。

---

## 架构图 / 图表

### mcp__drawio__diagram-workflow

- **类型**：MCP
- **来源**：当前用户提到的本地 MCP 工具；公开参考包括 https://github.com/simonkurtz-MSFT/drawio-mcp-server 和 https://github.com/os-tack/fcp-drawio
- **安装**：以本机 MCP 配置为准；Draw.io MCP 常见接入方式是用 Deno 启动 `drawio-mcp-server`，或用 Node >= 22 安装 `@ostk-ai/fcp-drawio` 后接入 MCP client。
- **作用**：通过 Agent 生成或编辑 Draw.io / diagrams.net 图，核心产物是标准 Draw.io XML / `.drawio`，方便后续在 draw.io、VS Code Draw.io 插件或团队文档中继续人工维护。
- **核心用法**：让 Agent 调用 `mcp__drawio__diagram-workflow`，提供图的目标、节点、关系、分组、层级和输出文件名；适合描述为“用 drawio 画一张可编辑架构图：前端、网关、服务、数据库、缓存、消息队列按层组织”。
- **适用场景**：正式工程文档、公司 wiki、PRD / 技术方案中的可编辑架构图、云资源图、服务依赖图、流程图、需要长期维护的系统地图。

### archify

- **类型**：skill
- **来源**：https://github.com/tt-a1i/archify
- **安装**：下载或使用仓库中的 `archify.zip`，解压到 Agent skills 目录；Codex CLI 可用 `unzip archify.zip -d ~/.agents/skills/`，类型化 renderer 需要在 skill 目录执行 `npm install`。
- **作用**：用自然语言生成专业技术图，输出单文件 HTML，内嵌 SVG，支持深色 / 浅色主题切换，并可导出 PNG / JPEG / WebP / SVG。
- **核心用法**：直接说“用 archify 画一张架构图 / workflow / sequence diagram / data flow / lifecycle diagram”，描述组件、调用顺序、数据流或状态流；需要校验时可用 `node bin/archify.mjs render <type> input.json output.html`、`validate`、`check`、`inspect`。
- **适用场景**：文章配图、README 图、方案展示图、演示材料、需要快速从自然语言迭代出漂亮技术图的场景；如果目标是可长期维护的 `.drawio` 源文件，优先用 Draw.io MCP。

---

## PPT / 幻灯片

### baoyu-slide-deck

- **类型**：skill
- **来源**：https://github.com/jimliu/baoyu-skills
- **安装**：`npx skills add jimliu/baoyu-skills -s baoyu-slide-deck -g -y`
- **作用**：将内容转换为专业幻灯片图片，并可合并为 PPTX / PDF。
- **核心用法**：`/baoyu-slide-deck path/to/content.md --style sketch-notes --audience executives --lang zh --slides 10`
- **适用场景**：快速生成图片版演示文稿、汇报材料、课程课件、适合阅读和分享的幻灯片。

### ppt-master

- **类型**：skill
- **来源**：https://github.com/hugohe3/ppt-master
- **安装**：`npx skills add hugohe3/ppt-master`；安装后在 skill 目录执行 `pip install -r requirements.txt`
- **作用**：把 PDF / DOCX / URL / Markdown / PPTX 等材料转换为原生可编辑 PPTX。
- **核心用法**：把源文件放进项目目录后，让 Agent 执行类似 `Please create a PPT from projects/q3-report/sources/report.pdf` 的任务。
- **适用场景**：正式汇报、研究报告转 PPT、已有 PPT 模板复用、需要后续人工编辑的 PowerPoint 文件。

### html-ppt

- **类型**：skill
- **来源**：https://github.com/lewislulu/html-ppt-skill
- **安装**：`npx skills add https://github.com/lewislulu/html-ppt-skill`
- **作用**：用静态 HTML / CSS / JS 生成专业演示文稿，主打模板、主题、布局和动画。
- **核心用法**：确认主题、受众、页数和风格后，用 `./scripts/new-deck.sh my-talk` scaffold，再从模板和参考资料中生成 HTML deck。
- **适用场景**：技术分享、课程、pitch deck、周报、需要浏览器播放、演讲者模式或动效的演示。

### guizang-ppt-skill

- **类型**：skill
- **来源**：https://github.com/op7418/guizang-ppt-skill
- **安装**：`npx skills add https://github.com/op7418/guizang-ppt-skill --skill guizang-ppt-skill`
- **作用**：生成单文件 HTML 横向翻页 PPT，并支持 PPT 配图和多平台封面。
- **核心用法**：先选择 Style A「电子杂志 × 电子墨水」或 Style B「瑞士国际主义」，再确认受众、时长、素材、图片需求、主题色和硬约束。
- **适用场景**：强风格演讲、行业分享、私享会、AI 产品发布、demo day、杂志风或瑞士风网页 PPT。

---

## 视频剪辑 / 视频生成

### video-use

- **类型**：skill
- **来源**：https://github.com/browser-use/video-use
- **安装**：克隆 `https://github.com/browser-use/video-use` 到稳定目录后，将目录软链到 Agent skills 目录，例如 `ln -sfn ~/Developer/video-use ~/.codex/skills/video-use`
- **作用**：对话式视频剪辑工作流，负责素材盘点、转写、粗剪、精剪、调色、字幕、动画叠加、自检和最终导出。
- **核心用法**：进入素材目录，让 Agent 先执行 `inventory these takes and propose a strategy`；确认剪辑策略后生成 EDL、预览视频和最终成片，输出到素材目录的 `edit/`。
- **适用场景**：talking head、采访、多 take 口播、产品发布、教程、旅行 / 活动 montage，需要 Agent 先理解素材再剪辑的任务。

### HyperFrames

- **类型**：skill
- **来源**：https://github.com/heygen-com/hyperframes
- **安装**：`npm install -g hyperframes` 或直接使用 `npx hyperframes <command>`
- **作用**：HTML 视频合成和动态图文引擎，用 HTML / CSS / GSAP 编写 composition，再渲染为 MP4 或透明 WebM。
- **核心用法**：`npx hyperframes init` 初始化项目，编写 `index.html` 和 compositions，运行 `npx hyperframes lint` / `inspect` / `render` 完成检查和导出。
- **适用场景**：标题卡、章节卡、字幕动效、产品 UI 动画、网站转视频、数据面板动效、透明 overlay。

### Remotion

- **类型**：skill
- **来源**：https://github.com/remotion-dev/skills
- **安装**：`npx skills add https://github.com/remotion-dev/skills --skill remotion-best-practices`
- **作用**：为 Remotion 提供视频工程最佳实践；Remotion 本身是用 React 组件、CSS、数据和时间帧生成视频的程序化视频框架。
- **核心用法**：用 `npx create-video@latest --yes --blank --no-tailwind my-video` 新建项目；在 `src/Root.tsx` 定义 composition；用 `useCurrentFrame()`、`interpolate()`、`Sequence` 编排动画；用 `npx remotion studio` 预览、`npx remotion render <CompositionId>` 导出。
- **适用场景**：React 技术栈、组件化视频、数据驱动视频、模板化批量生成、复杂状态动画、需要 Studio 调试的工程化视频。

### videocut-install

- **类型**：skill
- **来源**：https://github.com/zrt-ai-lab/opencode-skills
- **安装**：`npx skills add https://github.com/zrt-ai-lab/opencode-skills --skill videocut-install`
- **作用**：安装和验证 videocut 系列所需环境、依赖和模型。
- **核心用法**：首次使用 videocut 系列前运行，用于准备 FFmpeg、ASR、模型和本地脚本环境。
- **适用场景**：准备中文口播剪辑流水线、首次配置 videocut、排查 videocut 环境问题。

### videocut-clip-oral

- **类型**：skill
- **来源**：https://github.com/zrt-ai-lab/opencode-skills
- **安装**：`npx skills add https://github.com/zrt-ai-lab/opencode-skills --skill videocut-clip-oral`
- **作用**：转录中文口播视频，识别口误、语气词和静音，并生成审查稿与删除任务清单。
- **核心用法**：对口播视频说“剪口播 / 处理视频 / 识别口误”，生成 `*_transcript.json` 和 `*_审查稿.md`，等待用户确认删除项。
- **适用场景**：中文口播去口误、删除卡顿和静音、需要人工审核后再剪的短视频。

### videocut-clip

- **类型**：skill
- **来源**：https://github.com/zrt-ai-lab/opencode-skills
- **安装**：`npx skills add https://github.com/zrt-ai-lab/opencode-skills --skill videocut-clip`
- **作用**：根据确认后的删除任务执行 FFmpeg 精确裁剪。
- **核心用法**：读取 `videocut-clip-oral` 生成并经用户确认的时间戳删除清单，执行裁剪并循环检查。
- **适用场景**：口播视频按时间戳删口误、删静音、快速生成干净口播版本。

### videocut-subtitle

- **类型**：skill
- **来源**：https://github.com/zrt-ai-lab/opencode-skills
- **安装**：`npx skills add https://github.com/zrt-ai-lab/opencode-skills --skill videocut-subtitle`
- **作用**：生成字幕稿、匹配时间戳、生成 SRT 并烧录字幕。
- **核心用法**：先转录视频并输出可编辑字幕稿；用户审核修改后，再匹配时间戳生成 `.srt` 并用 FFmpeg 烧录成带字幕视频。
- **适用场景**：中文短视频加字幕、口播视频字幕校对、需要人工审核字幕文本后再烧录的场景。

### videocut-self-update

- **类型**：skill
- **来源**：https://github.com/zrt-ai-lab/opencode-skills
- **安装**：`npx skills add https://github.com/zrt-ai-lab/opencode-skills --skill videocut-self-update`
- **作用**：记录用户对 videocut 剪辑结果的反馈，并更新方法论和识别规则。
- **核心用法**：在用户指出误判、漏判或剪辑偏好后，把反馈沉淀到 videocut 的规则中，供后续口播剪辑复用。
- **适用场景**：长期优化个人口播剪辑风格、积累口误识别规则、改进同类视频处理偏好。

### video-subtitle-remover

- **类型**：skill
- **来源**：https://github.com/zrt-ai-lab/opencode-skills
- **安装**：`npx skills add https://github.com/zrt-ai-lab/opencode-skills --skill video-subtitle-remover`
- **作用**：基于模型去除视频硬字幕或水印。
- **核心用法**：输入带硬字幕或水印的视频，让 Agent 调用本地去除流程生成清理后的视频。
- **适用场景**：素材二次处理、去除旧字幕、水印清理、需要获得更干净画面的再剪辑任务。
