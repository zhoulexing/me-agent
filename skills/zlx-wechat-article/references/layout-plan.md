# Output layout and insertion plan

Use this output structure for each article:

```text
wechat-publish/<article-slug>/
├── source.md
├── cover-prompt.md
├── prompts/
│   ├── 01-<slug>.md
│   └── ...
├── images/
│   ├── cover-source.png
│   ├── cover.png
│   ├── cover-square-preview.png
│   ├── 01-<slug>.png
│   └── ...
├── layout.json
├── article.html
└── publish-result.json
```

`source.md` is immutable after it is copied. `layout.json` describes only additions around the source blocks:

```json
{
  "insertions": [
    {
      "before": 0,
      "heading": "为什么现在需要重新理解这件事",
      "image": "images/01-opening.png",
      "alt": "文章开篇主题插图",
      "caption": ""
    },
    {
      "before": 4,
      "heading": "真正发生变化的地方",
      "image": "images/02-change.png",
      "alt": "变化过程示意图"
    }
  ]
}
```

Fields:

- `before`: zero-based source block index. `0` inserts before the first block; the source block count inserts after the last block.
- `heading`: optional new H2 label. This is structural text, not a replacement for source text.
- `image`: optional local path or HTTP(S) URL. Resolve relative local paths from the `layout.json` directory.
- `alt`: optional accessibility text.
- `caption`: optional visible caption. Omit it unless it adds real provenance or context.

At least one of `heading` or `image` is required per insertion. Keep insertions in reading order. Prefer 3-5 image-bearing insertions.
