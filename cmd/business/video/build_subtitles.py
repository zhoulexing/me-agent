#!/usr/bin/env python3
"""Build phrase-level SRT and JSON captions from a reviewed timestamped transcript."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


HEADING_RE = re.compile(
    r"^##\s+(\d{2}):(\d{2})\.(\d{2})[–-](\d{2}):(\d{2})\.(\d{2})\s*$"
)
CLAUSE_RE = re.compile(r"[^，。！？；：]+[，。！？；：]?")


def seconds(mm: str, ss: str, cs: str) -> float:
    return int(mm) * 60 + int(ss) + int(cs) / 100


def parse_reviewed_transcript(path: Path) -> list[dict]:
    blocks: list[dict] = []
    current: dict | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        match = HEADING_RE.match(line.strip())
        if match:
            if current and current["lines"]:
                current["text"] = "".join(current.pop("lines")).strip()
                blocks.append(current)
            current = {
                "source_start": seconds(*match.groups()[:3]),
                "source_end": seconds(*match.groups()[3:]),
                "lines": [],
            }
            continue
        if line.startswith("## "):
            if current and current["lines"]:
                current["text"] = "".join(current.pop("lines")).strip()
                blocks.append(current)
            current = None
            continue
        if current is not None and line.strip() and not line.startswith(">"):
            current["lines"].append(line.strip())
    if current and current["lines"]:
        current["text"] = "".join(current.pop("lines")).strip()
        blocks.append(current)
    return blocks


def visible_length(text: str) -> int:
    return max(1, len(re.sub(r"[\s，。！？；：、“”‘’]", "", text)))


def hard_split(text: str, max_chars: int) -> list[str]:
    pieces: list[str] = []
    units = re.findall(r"[A-Za-z0-9]+|[\u4e00-\u9fff]|[^A-Za-z0-9\u4e00-\u9fff]", text)
    current = ""
    for unit in units:
        candidate = current + unit
        if current.strip() and visible_length(candidate) > max_chars:
            pieces.append(current.strip())
            current = unit.lstrip()
        else:
            current = candidate
    if current.strip():
        pieces.append(current.strip())
    if (
        len(pieces) >= 2
        and visible_length(pieces[-1]) <= 3
        and visible_length(pieces[-2] + pieces[-1]) <= max_chars + 4
    ):
        pieces[-2] = pieces[-2] + pieces[-1]
        pieces.pop()
    return pieces


def chunk_text(text: str, max_chars: int) -> list[str]:
    clauses = [part.strip() for part in CLAUSE_RE.findall(text) if part.strip()]
    chunks: list[str] = []
    pending = ""
    for clause in clauses:
        if visible_length(clause) > max_chars:
            if pending:
                chunks.append(pending)
                pending = ""
            chunks.extend(hard_split(clause, max_chars))
            continue
        candidate = pending + clause
        if pending and visible_length(candidate) > max_chars:
            chunks.append(pending)
            pending = clause
        else:
            pending = candidate
    if pending:
        chunks.append(pending)
    return chunks


def map_source_time(source_time: float, ranges: list[dict]) -> float:
    output_offset = 0.0
    for item in ranges:
        start = float(item["start"])
        end = float(item["end"])
        if start <= source_time <= end:
            return output_offset + source_time - start
        output_offset += end - start
    raise ValueError(f"Source time {source_time:.3f}s falls outside the EDL ranges")


def block_output_window(block: dict, ranges: list[dict]) -> tuple[float, float] | None:
    for item in ranges:
        start = max(float(item["start"]), block["source_start"])
        end = min(float(item["end"]), block["source_end"])
        if end > start:
            return map_source_time(start, ranges), map_source_time(end, ranges)
    return None


def build_captions(blocks: list[dict], ranges: list[dict], max_chars: int) -> list[dict]:
    captions: list[dict] = []
    for block in blocks:
        window = block_output_window(block, ranges)
        if window is None:
            continue
        start, end = window
        chunks = chunk_text(block["text"], max_chars)
        weights = [visible_length(chunk) for chunk in chunks]
        total_weight = sum(weights)
        cursor = start
        for index, (chunk, weight) in enumerate(zip(chunks, weights)):
            chunk_end = end if index == len(chunks) - 1 else cursor + (end - start) * weight / total_weight
            captions.append(
                {
                    "text": chunk,
                    "start": round(cursor, 3),
                    "end": round(max(cursor + 0.35, chunk_end), 3),
                }
            )
            cursor = chunk_end
    for current, following in zip(captions, captions[1:]):
        if current["end"] > following["start"]:
            current["end"] = round(following["start"], 3)
    return repair_boundaries(captions, max_chars)


def repair_boundaries(captions: list[dict], max_chars: int) -> list[dict]:
    protected_words = ("进化", "有没有", "应该", "真正", "今天")
    repaired: list[dict] = []
    index = 0
    while index < len(captions):
        current = dict(captions[index])
        if index + 1 < len(captions):
            following = captions[index + 1]
            splits_word = any(
                current["text"].endswith(word[:split])
                and following["text"].startswith(word[split:])
                for word in protected_words
                for split in range(1, len(word))
            )
            short_latin_tail = (
                bool(re.search(r"[A-Za-z]", following["text"]))
                and visible_length(following["text"]) <= 6
            )
            if (splits_word or short_latin_tail) and visible_length(
                current["text"] + following["text"]
            ) <= max_chars + 8:
                current["text"] += following["text"]
                current["end"] = following["end"]
                index += 1
        repaired.append(current)
        index += 1
    return repaired


def srt_timestamp(value: float) -> str:
    milliseconds = max(0, round(value * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds_value, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds_value:02d},{millis:03d}"


def write_srt(captions: list[dict], path: Path) -> None:
    rows: list[str] = []
    for index, caption in enumerate(captions, start=1):
        rows.extend(
            [
                str(index),
                f"{srt_timestamp(caption['start'])} --> {srt_timestamp(caption['end'])}",
                caption["text"],
                "",
            ]
        )
    path.write_text("\n".join(rows), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcript", type=Path, required=True)
    parser.add_argument("--edl", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--output-srt", type=Path, required=True)
    parser.add_argument("--max-chars", type=int, default=16)
    args = parser.parse_args()

    blocks = parse_reviewed_transcript(args.transcript)
    edl = json.loads(args.edl.read_text(encoding="utf-8"))
    captions = build_captions(blocks, edl["ranges"], args.max_chars)
    args.output_json.write_text(
        json.dumps(captions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_srt(captions, args.output_srt)
    print(f"built {len(captions)} captions")


if __name__ == "__main__":
    main()
