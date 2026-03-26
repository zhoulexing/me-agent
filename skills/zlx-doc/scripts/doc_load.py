#!/usr/bin/env python3
"""Document load CLI for the standalone zlx-doc skill."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
DEFAULT_ASSETS_DIR = SKILL_ROOT / "assets" / "runtime"


def render_output(doc: object, output_format: str) -> str:
    if output_format == "json":
        return json.dumps(doc.to_dict(), ensure_ascii=False, indent=2)
    if output_format == "markdown":
        title = Path(str(doc.source)).name or doc.doc_type or "document"
        return f"# {title}\n\n{doc.content}"
    return doc.content


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="读取本地文件或 URL 并输出完整文档内容",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s README.md
  %(prog)s ./demo.pdf --format json
  %(prog)s "https://mp.weixin.qq.com/s/xxxx"
  %(prog)s "https://arxiv.org/abs/1706.03762" --format markdown
  %(prog)s "https://example.com/report.pdf" --output /tmp/report.json --format json
        """.strip(),
    )
    parser.add_argument("source", help="本地文件路径或 URL")
    parser.add_argument(
        "--format",
        choices=["text", "json", "markdown"],
        default="text",
        help="输出格式，默认 text",
    )
    parser.add_argument("-o", "--output", help="输出文件路径；不传则写到 stdout")
    parser.add_argument(
        "--assets-dir",
        default=str(DEFAULT_ASSETS_DIR),
        help="超长内容自动落盘目录，默认在技能 assets/runtime 下",
    )
    parser.add_argument(
        "--save-threshold",
        type=int,
        default=12000,
        help="当未指定 --output 且内容长度超过该阈值时，自动落盘到 assets 目录",
    )
    parser.add_argument(
        "--temp-dir",
        help="远程 PDF/Word 下载后的临时目录；默认使用系统临时目录",
    )
    parser.add_argument(
        "--print-metadata",
        action="store_true",
        help="在 stderr 输出文档类型、字符数和落盘信息",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        from reader_core import DocumentReader, ReaderError, dump_large_content
    except ModuleNotFoundError as exc:
        print(
            f"缺少运行依赖: {exc.name}。请先执行 "
            f"`bash {SCRIPT_DIR / 'setup.sh'}` 安装技能依赖。",
            file=sys.stderr,
        )
        return 1

    try:
        reader = DocumentReader(temp_root=args.temp_dir)
        document = reader.load(args.source)
        output_text = render_output(document, args.format)
        saved_to = None

        if args.output:
            output_path = Path(args.output).expanduser().resolve()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(output_text, encoding="utf-8")
            saved_to = str(output_path)
            print(saved_to)
        else:
            output_text, auto_saved = dump_large_content(
                document=document,
                output_text=output_text,
                assets_dir=args.assets_dir,
                threshold=args.save_threshold,
                output_format=args.format,
            )
            saved_to = auto_saved
            print(output_text)

        if args.print_metadata:
            meta = {
                "doc_id": document.doc_id,
                "doc_type": document.doc_type,
                "content_length": len(document.content),
                "saved_to": saved_to,
            }
            print(json.dumps(meta, ensure_ascii=False), file=sys.stderr)
        return 0
    except ReaderError as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"未知错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
