#!/usr/bin/env python3
"""Convert whisper.cpp full JSON into an editable timestamped Markdown transcript."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def stamp(milliseconds: int) -> str:
    minutes, remainder = divmod(milliseconds, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{minutes:02d}:{seconds:02d}.{millis // 10:02d}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    data = json.loads(args.input.read_text(encoding="utf-8", errors="replace"))
    rows = [
        "# 视频文字校对稿",
        "",
        "> 只修正错别字、专有名词和标点；保留口播原意与时间码。",
        "",
    ]
    for segment in data.get("transcription", []):
        offsets = segment["offsets"]
        rows.extend(
            [
                f"## {stamp(int(offsets['from']))}–{stamp(int(offsets['to']))}",
                "",
                segment.get("text", "").strip(),
                "",
            ]
        )
    args.output.write_text("\n".join(rows), encoding="utf-8")
    print(f"wrote {len(data.get('transcription', []))} transcript blocks")


if __name__ == "__main__":
    main()
