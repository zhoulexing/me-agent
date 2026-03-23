---
name: ark-image-gen
description: |
  ARK 图像生成与编辑能力。用于当用户提出文生图、图生图（基于参考图编辑）、多图融合（把多张参考图合成一张）等请求时，基于用户的 `prompt` 与参考图 URL 调用 ARK `images/generations` 接口，并把输出图片保存到本地。

  触发场景：
  - `text2img`：用户只给提示词，要生成新图
  - `img2img`：用户提供 1 张参考图 URL（或等价素材），要保留主体/姿势进行编辑
  - `fusion`：用户提供 不少于 2 张参考图 URL，要进行多图融合/换装/风格拼接（脚本会设置 `sequential_image_generation: "disabled"`）

  运行所需环境变量：
  - `ARK_API_KEY`（Bearer Token）- 脚本会从 `/Users/zhouyuexing/clawd/project/me-agent/04-个人技能/.env` 文件中读取，也支持从系统环境变量读取
---

# ARK 图像生成与多图融合

## 功能概述

该技能用于把用户的”生成/编辑/融合图片需求”落到可执行的 ARK Image API 调用上，并把生成结果下载保存到本地。根据输入自动选择：
- `text2img`：仅提示词生成新图
- `img2img`：提示词 + 1 张参考图编辑
- `fusion`：提示词 + 多张参考图融合（脚本会设置 `sequential_image_generation: “disabled”`）


## 使用方法

1. 脚本会自动从 `/Users/zhouyuexing/clawd/project/me-agent/04-个人技能/.env` 读取 `ARK_API_KEY`
2. 使用脚本 `scripts/ark_image_gen.py` 生成图片：
   - 文生图（text2img）：`--mode text2img --prompt "<prompt>"`
   - 图生图（img2img）：`--mode img2img --prompt "<prompt>" --image-url "<url>"`
   - 多图融合（fusion）：`--mode fusion --prompt "<prompt>" --image-url "<url1>" --image-url "<url2>" ...`
3. 生成的图片默认保存到 `assets/` 目录，脚本会打印保存路径

## 资源目录说明

### scripts/
可执行的代码（Python/Bash 等），用于直接执行特定操作。

**其他技能示例：**
- PDF 技能：`fill_fillable_fields.py`、`extract_form_field_info.py` - PDF 处理工具
- DOCX 技能：`document.py`、`utilities.py` - 文档处理的 Python 模块

**适用场景：** Python 脚本、Shell 脚本，或任何执行自动化、数据处理或特定操作的代码。

**注意：** 脚本可以在不加载到上下文的情况下执行，但仍然可以被 Claude 读取以进行修补或环境调整。

### references/
文档和参考资料，用于加载到上下文中以指导 Claude 的处理流程和思考。

**其他技能示例：**
- 产品管理：`communication.md`、`context_building.md` - 详细的工作流程指南
- BigQuery：API 参考文档和查询示例
- 财务：架构文档、公司政策

**适用场景：** 深度文档、API 参考、数据库架构、综合指南，或 Claude 在工作中应该参考的任何详细信息。

### assets/
不用于加载到上下文，而是用于 Claude 生成输出的文件。

**其他技能示例：**
- 品牌样式：PowerPoint 模板文件（.pptx）、Logo 文件
- 前端构建器：HTML/React 样板项目目录
- 字体：字体文件（.ttf、.woff2）

**适用场景：** 模板、样板代码、文档模板、图片、图标、字体，或任何要复制或用于最终输出的文件。

---

**不需要的目录可以删除。** 并非每个技能都需要所有三种类型的资源。
