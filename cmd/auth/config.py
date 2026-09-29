"""Read zlx-cli JSON configuration from the me-agent project root."""

from __future__ import annotations

import json
import os
from pathlib import Path


CONFIG_DIR = Path(__file__).resolve().parents[2] / ".config"
NAMES = {"getnote", "wechat", "ark", "zlx-cli"}


def config_path(name: str) -> Path:
    if name not in NAMES:
        raise ValueError(f"未知配置: {name}")
    return CONFIG_DIR / f"{name}.json"


def read_config(name: str, required: bool = True) -> dict:
    path = config_path(name)
    if not path.exists():
        if not required:
            return {}
        raise ValueError(f"缺少配置文件: {path}")
    if not path.is_file():
        raise ValueError(f"配置路径不是文件: {path}")
    if os.name != "nt" and path.stat().st_mode & 0o077:
        raise ValueError(f"配置文件权限过宽，请执行 chmod 600 '{path}'")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"配置文件不是有效 JSON: {path} ({error})") from error
    if not isinstance(data, dict):
        raise ValueError(f"配置文件必须是 JSON 对象: {path}")
    return data


def write_runtime_python(python_path: str) -> None:
    path = config_path("zlx-cli")
    data = read_config("zlx-cli", required=False)
    data["documentPython"] = python_path
    CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with os.fdopen(os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


if __name__ == "__main__":
    import sys

    if sys.argv[1:3] == ["get", "documentPython"]:
        print(read_config("zlx-cli", required=False).get("documentPython", ""))
    elif len(sys.argv) == 3 and sys.argv[1] == "set-document-python":
        write_runtime_python(sys.argv[2])
    else:
        raise SystemExit("用法: config.py get documentPython | set-document-python <Python路径>")
