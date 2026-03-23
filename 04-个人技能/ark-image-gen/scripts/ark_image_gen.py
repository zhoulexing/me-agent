#!/usr/bin/env python3
"""
ARK Image API wrapper (skill-local).

Modes:
- text2img: prompt -> image
- img2img: prompt + one image url -> edited image
- fusion: prompt + multiple image urls -> multi-image fusion

Required env:
  ARK_API_KEY
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def load_env_file(env_file: str) -> Dict[str, str]:
    """从 .env 文件加载环境变量"""
    env_vars = {}
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # 跳过注释和空行
                if not line or line.startswith('#'):
                    continue
                # 解析 KEY=VALUE 格式
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars


ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"


def _json_dumps(data: Dict[str, Any]) -> bytes:
    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def _http_post_json(url: str, headers: Dict[str, str], payload: Dict[str, Any], timeout_s: int = 300) -> Any:
    req = urllib.request.Request(
        url,
        data=_json_dumps(payload),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    try:
        return json.loads(body)
    except Exception:
        return {"_raw": body}


def _guess_ext_from_url(url: str, default_ext: str) -> str:
    m = re.search(r"\.(png|jpg|jpeg|webp|gif)(?:\?|$)", url, flags=re.IGNORECASE)
    if m:
        return m.group(1).lower()
    return default_ext


def _download_to_file(url: str, path: Path, timeout_s: int = 300) -> None:
    with urllib.request.urlopen(url, timeout=timeout_s) as resp:
        data = resp.read()
    path.write_bytes(data)


def _extract_image_blobs(resp_json: Any) -> List[Tuple[str, Optional[str]]]:
    """
    Returns list of (image_source_type, value)
      - ("url", image_url)
      - ("b64", base64_string_without_data_prefix)
    """
    results: List[Tuple[str, Optional[str]]] = []

    if not isinstance(resp_json, dict):
        return results

    candidates: List[Any] = []
    for key in ["data", "images", "results", "output", "outputs"]:
        v = resp_json.get(key)
        if isinstance(v, list):
            candidates = v
            break

    if not candidates:
        return results

    for item in candidates:
        if not isinstance(item, dict):
            continue

        for url_key in ["url", "image_url", "imageUrl", "img_url", "link"]:
            if isinstance(item.get(url_key), str) and item[url_key]:
                results.append(("url", item[url_key]))
                break
        else:
            for b64_key in ["b64_image", "b64", "image_b64", "base64", "data"]:
                if isinstance(item.get(b64_key), str) and item[b64_key]:
                    results.append(("b64", item[b64_key]))
                    break

    return results


def _decode_b64_image(b64: str) -> bytes:
    # Accept data URLs like: data:image/png;base64,xxxx
    if b64.startswith("data:") and "base64," in b64:
        b64 = b64.split("base64,", 1)[1]
    return base64.b64decode(b64, validate=False)


def build_payload(
    mode: str,
    model: str,
    prompt: str,
    size: str,
    output_format: Optional[str],
    watermark: bool,
    image_url: Optional[str],
    image_urls: Optional[List[str]],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "watermark": watermark,
    }
    # 只有明确指定 output_format 时才添加（API 可能不支持此参数）
    if output_format and output_format.lower() != "none":
        payload["output_format"] = output_format

    if mode == "text2img":
        return payload

    if mode == "img2img":
        if not image_url:
            raise ValueError("img2img requires --image-url")
        payload["image"] = image_url
        return payload

    if mode == "fusion":
        if not image_urls or len(image_urls) < 2:
            raise ValueError("fusion requires --image-url (at least 2 times)")
        payload["image"] = image_urls
        payload["sequential_image_generation"] = "disabled"
        return payload

    raise ValueError(f"Unknown mode: {mode}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="ARK Image API generator (text2img / img2img / fusion)")
    p.add_argument("--mode", choices=["text2img", "img2img", "fusion"], required=True)
    p.add_argument("--model", default="doubao-seedream-4-5-251128")
    p.add_argument("--prompt", required=True)
    p.add_argument("--size", default="2K")
    p.add_argument("--output-format", default=None, dest="output_format", help="默认不设置（API 使用默认格式）")
    p.add_argument("--watermark", default="false", choices=["true", "false"])
    p.add_argument("--image-url", action="append", default=[], help="reference image url (repeatable)")
    p.add_argument("--out-dir", default="assets")
    p.add_argument("--dry-run", action="store_true", help="print payload and exit without calling API")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # 优先从指定的 .env 文件读取 API key
    env_file = "/Users/zhouyuexing/clawd/project/me-agent/04-个人技能/.env"
    env_vars = load_env_file(env_file)
    api_key = env_vars.get("ARK_API_KEY") or os.environ.get("ARK_API_KEY")

    if not api_key:
        print(f"Missing ARK_API_KEY. Please set it in {env_file} or environment.", file=sys.stderr)
        sys.exit(2)

    watermark = args.watermark == "true"
    image_url = args.image_url[0] if args.image_url else None
    image_urls = args.image_url if args.image_url else None

    payload = build_payload(
        mode=args.mode,
        model=args.model,
        prompt=args.prompt,
        size=args.size,
        output_format=args.output_format,
        watermark=watermark,
        image_url=image_url,
        image_urls=image_urls,
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    print("ARK payload:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    # 处理输出目录：如果是相对路径，基于脚本所在目录的父目录（skill根目录）
    script_dir = Path(__file__).parent.resolve()
    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        # 相对路径：基于 skill 根目录（scripts/ 的上一级）
        out_dir = script_dir.parent / args.out_dir
    out_dir = out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        print(f"[dry-run] Not calling API. Outputs would go to: {out_dir}")
        return

    resp_json = _http_post_json(ARK_URL, headers=headers, payload=payload)
    print("ARK raw response (truncated):")
    resp_text = json.dumps(resp_json, ensure_ascii=False)
    if len(resp_text) > 4000:
        resp_text = resp_text[:4000] + "...(truncated)"
    print(resp_text)

    blobs = _extract_image_blobs(resp_json)
    if not blobs:
        print("Could not find image URLs/base64 in response. Please inspect raw response above.", file=sys.stderr)
        return

    saved_paths: List[str] = []
    for idx, (t, val) in enumerate(blobs, start=1):
        if not val:
            continue

        if t == "url":
            ext = _guess_ext_from_url(val, args.output_format)
            out_path = out_dir / f"ark_{args.mode}_{idx}.{ext}"
            _download_to_file(val, out_path)
            saved_paths.append(str(out_path))
        elif t == "b64":
            ext = args.output_format
            out_path = out_dir / f"ark_{args.mode}_{idx}.{ext}"
            data = _decode_b64_image(val)
            out_path.write_bytes(data)
            saved_paths.append(str(out_path))

    if saved_paths:
        print("Saved images:")
        for p in saved_paths:
            print(f"- {p}")
    else:
        print("No images saved (unexpected response structure).", file=sys.stderr)


if __name__ == "__main__":
    main()

