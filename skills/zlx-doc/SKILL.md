---
name: zlx-doc
description: 通用文档读取技能。支持从本地文件或远程 URL 读取多种格式文档内容，包括文本文档(txt/md)、表格(xlsx)、文档(pdf/doc/docx)、网页(含公众号文章)、学术论文(arXiv)等。适用于需要提取文档全文、解析网页文章内容、读取 PDF/Word 文档、获取公众号文章或 arXiv 论文全文，或将超长阅读结果自动保存到技能资源目录供后续使用的场景。
---

# Zlx-Doc 读取技能

## 环境准备

首次使用需安装依赖：

```bash
bash scripts/setup.sh
```

说明：

- `setup.sh` 会自动选择可用的 Python 解释器，不再依赖当前 shell 里的 `python3` 指向什么。
- 如果机器上已经有带依赖的解释器，脚本会直接复用；否则会在 skill 目录下创建 `.venv/` 私有环境。
- 即使你误用到错误的 `python3`，`doc_load.py` 也会优先跳转到 skill 已记录的正确解释器。

## 读取命令

技能只保留一个 CLI 入口：

```bash
python scripts/doc_load.py <source> [options]
```

常用示例：

```bash
# 本地 Markdown / TXT / PDF / Word / Excel
python scripts/doc_load.py README.md
python scripts/doc_load.py ./demo.pdf --format json

# 远程 PDF / Word
python scripts/doc_load.py "https://example.com/report.pdf"
python scripts/doc_load.py "https://example.com/spec.docx" --output /tmp/spec.md --format markdown

# 公众号文章 / 普通网页
python scripts/doc_load.py "https://mp.weixin.qq.com/s/xxxx"
python scripts/doc_load.py "https://example.com/blog/post"

# arXiv
python scripts/doc_load.py "https://arxiv.org/abs/1706.03762" --format markdown
```

## 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `source` | 是 | 文件路径或 URL |
| `--format` | 否 | 输出格式：`text`（默认）、`json`、`markdown` |
| `-o/--output` | 否 | 指定输出文件路径；传入后不会走 assets 自动落盘 |
| `--assets-dir` | 否 | 超长内容自动保存目录，默认 `assets/runtime` |
| `--save-threshold` | 否 | 未指定 `--output` 时，内容超过该字符数就自动落盘到 assets |
| `--temp-dir` | 否 | 远程 PDF/Word 下载临时目录 |
| `--print-metadata` | 否 | 在 stderr 输出文档类型、字符数和保存路径 |

## 支持的格式

| 格式 | 扩展名 | 来源 | 配置要求 |
|------|--------|------|---------|
| 文本 | .txt | 本地/URL | 无 |
| Markdown | .md | 本地/URL | 无 |
| Excel | .xlsx, .xls | 仅本地 | 无 |
| PDF | .pdf | 本地/URL | 无 |
| Word | .doc, .docx | 本地/URL | 无 |
| 普通网页 | 无扩展名 URL / .html | URL | 无 |
| 公众号文章 | `mp.weixin.qq.com` | URL | 无 |
| arXiv | `arxiv.org/abs/...` / `arxiv.org/pdf/...` | URL | 无 |

## JSON 输出示例

```json
{
  "doc_id": "doc_abc123",
  "content": "文档内容...",
  "doc_type": "pdf",
  "source": "README.md",
  "metadata": {"loader": "langchain"},
  "created_at": "2025-01-01T00:00:00"
}
```

## 长内容处理

- 这个技能只做读取，不做切分。
- 如果文档很长且没有指定 `--output`，CLI 会把完整结果写入 `assets/runtime/`，stdout 只返回一段简短 JSON，告诉调用方保存路径。
- 若希望拿到完整内容，优先显式传 `--output`。

## 注意事项

- 不依赖 `packages/yz_doc`，技能内部脚本是独立实现。
- 已移除飞书、七牛和 AIGC 相关逻辑。
- 远程 PDF / Word 会先下载到临时目录，再通过 LangChain 相关 loader 读取。
- `arxiv.org` 链接优先走 `ArxivLoader`，其他网页走 `WebBaseLoader`。
