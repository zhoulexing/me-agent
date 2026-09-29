#!/usr/bin/env python3
import html
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPORT = ROOT / "report.md"
SOURCES = ROOT / "sources.jsonl"
OUTPUT = ROOT / "report.html"
CONVERTER = Path("/Users/zhouyuexing/.agents/skills/deep-research/scripts/md_to_html.py")

spec = importlib.util.spec_from_file_location("deep_research_md", CONVERTER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

markdown = REPORT.read_text(encoding="utf-8")
main_md = markdown.split("## Bibliography", 1)[0]
body = module._convert_content_section(main_md)

# Complete a few Markdown constructs not covered by the bundled converter.
body = re.sub(r'<p>---<\/p>', '<hr>', body)
body = re.sub(r'<p>&gt;\s*(.*?)<\/p>', r'<blockquote>\1</blockquote>', body)
body = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', body)

sources = []
for line in SOURCES.read_text(encoding="utf-8").splitlines():
    if line.strip():
        sources.append(json.loads(line))

bibliography = []
for number, source in enumerate(sources, 1):
    author = source.get("authors") or ""
    year = source.get("year") or "n.d."
    title = source.get("title") or "Untitled"
    url = source.get("raw_url") or ""
    bibliography.append(
        f'<div class="bib-entry" id="source-{number}">'
        f'<span class="bib-number">[{number}]</span> '
        f'{html.escape(str(author))} ({html.escape(str(year))}). '
        f'<a href="{html.escape(url)}">{html.escape(title)}</a></div>'
    )

document = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>达里奥·阿莫迪：造出更强的智能，然后试图控制它</title>
<style>
@page {{ size: A4; margin: 18mm 17mm 20mm; }}
:root {{ --ink:#17202a; --muted:#667085; --rule:#d0d5dd; --accent:#8d3c28; --soft:#f6f1ec; --blue:#344b68; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; color:var(--ink); background:#ece8e2; font-family:"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif; line-height:1.82; font-size:16px; }}
.page {{ width:min(920px,100%); margin:30px auto; background:white; padding:64px 76px 84px; box-shadow:0 12px 36px rgba(40,35,30,.12); }}
.cover {{ min-height:720px; display:flex; flex-direction:column; justify-content:center; border-top:10px solid var(--accent); padding:50px 0 80px; }}
.kicker {{ color:var(--accent); letter-spacing:.18em; font-weight:700; font-size:13px; }}
h1 {{ font-family:"Songti SC","STSong",serif; font-size:48px; line-height:1.2; margin:24px 0 20px; letter-spacing:-.02em; }}
.subtitle {{ font-size:22px; color:var(--blue); margin:0 0 42px; }}
.meta {{ margin-top:auto; color:var(--muted); font-size:14px; border-top:1px solid var(--rule); padding-top:18px; }}
.section {{ margin-top:58px; }}
.section-title {{ font-family:"Songti SC","STSong",serif; font-size:30px; line-height:1.35; margin:0 0 24px; color:#1b2b3b; border-left:5px solid var(--accent); padding-left:16px; }}
.subsection-title {{ font-size:24px; line-height:1.45; margin:42px 0 18px; color:var(--accent); }}
.subsubsection-title {{ font-size:18px; margin:30px 0 12px; color:var(--blue); }}
p {{ margin:0 0 17px; text-align:justify; }}
strong {{ color:#1a2938; }}
hr {{ border:0; border-top:1px solid var(--rule); margin:46px 0; }}
blockquote {{ margin:26px 0; padding:18px 22px; background:var(--soft); border-left:4px solid var(--accent); color:#3e4650; font-family:"Songti SC","STSong",serif; font-size:18px; }}
ul,ol {{ padding-left:1.5em; margin:10px 0 24px; }}
li {{ margin:8px 0; }}
table {{ width:100%; border-collapse:collapse; margin:24px 0 34px; font-size:13px; line-height:1.58; break-inside:auto; }}
thead {{ background:#eef1f4; }}
th,td {{ border:1px solid #d7dce1; padding:10px 11px; vertical-align:top; text-align:left; }}
th {{ color:#26384a; }}
a {{ color:#365d87; text-decoration:none; }}
.bibliography {{ margin-top:70px; padding-top:38px; border-top:2px solid var(--ink); }}
.bib-entry {{ font-size:12px; line-height:1.55; padding:8px 0; border-bottom:1px dotted #d8d8d8; break-inside:avoid; }}
.bib-number {{ display:inline-block; min-width:30px; color:var(--accent); font-weight:700; }}
@media print {{ body {{ background:white; font-size:11.5pt; }} .page {{ width:auto; margin:0; padding:0; box-shadow:none; }} .cover {{ min-height:245mm; page-break-after:always; }} h1 {{ font-size:35pt; }} .section-title {{ break-after:avoid; }} .subsection-title,.subsubsection-title {{ break-after:avoid; }} table {{ font-size:8.5pt; }} a {{ color:inherit; }} }}
@media (max-width:700px) {{ .page {{ margin:0; padding:36px 24px 60px; }} h1 {{ font-size:38px; }} }}
</style>
</head>
<body><main class="page">
<header class="header">
<section class="cover">
  <div class="kicker">FOUNDER · TECHNOLOGY · POWER</div>
  <h1>达里奥·阿莫迪：<br>造出更强的智能，<br>然后试图控制它</h1>
  <p class="subtitle">一份围绕六幕叙事结构的完整研究报告</p>
  <div class="meta">研究对象：Dario Amodei 与 Daniela Amodei<br>研究日期：2026 年 7 月 20 日<br>用途：人物视频文字稿研究底稿</div>
</section>
</header>
<div class="content">
{body}
</div>
<section class="bibliography"><h2 class="section-title">Bibliography｜参考资料</h2>{''.join(bibliography)}</section>
</main></body></html>'''

OUTPUT.write_text(document, encoding="utf-8")
print(OUTPUT)
