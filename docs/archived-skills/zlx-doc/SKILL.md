---
name: zlx-doc
description: 读取本地文件、网页、公众号文章、PDF、Word、Excel 或 arXiv 论文并提取正文。用于需要核对原文的任务。
---

# 文档读取

统一使用 `zlx-cli doc read`。本 Skill 负责判断读取对象、核对来源与引用；文档解析代码位于项目根目录 `cmd/business/document/`。

```bash
zlx-cli doc read "<文件路径或URL>" --format markdown
zlx-cli doc read "<文件路径或URL>" --format json --output /tmp/document.json
```

支持 txt、md、PDF、Word、Excel、普通网页、公众号文章和 arXiv。超长结果默认保存到工作区 `.zlx-cli/documents/`，命令输出保存路径。首次缺少 Python 依赖时运行 `zlx-cli doc setup`，再重试读取。

读取远端内容时保留原始 URL；对需要准确引用的结论，回到原文核对，不把解析失败或摘要当作完整正文。
