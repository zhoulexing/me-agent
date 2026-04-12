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
