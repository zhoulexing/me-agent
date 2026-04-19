#!/usr/bin/env python3
"""Resolve a usable Python runtime for the zlx-doc skill."""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
RUNTIME_FILE = SKILL_ROOT / ".runtime-python"
VENV_PYTHON = SKILL_ROOT / ".venv" / "bin" / "python"
REQUIRED_MODULES = ("langchain_community", "httpx")
ENV_FLAG = "_ZLX_DOC_RUNTIME_READY"
KNOWN_PYTHONS = (
    "/Users/zhouyuexing/miniforge3/bin/python3",
    "/opt/homebrew/bin/python3",
    "/usr/bin/python3",
)


def _normalize_path(value: str | None) -> str | None:
    if not value:
        return None
    path = Path(value).expanduser()
    if not path.is_absolute():
        resolved = shutil.which(value)
        if not resolved:
            return None
        path = Path(resolved)
    if not path.exists():
        return None
    return str(path.resolve())


def candidate_pythons() -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()

    def add(value: str | None) -> None:
        normalized = _normalize_path(value)
        if not normalized or normalized in seen:
            return
        seen.add(normalized)
        candidates.append(normalized)

    add(os.environ.get("ZLX_DOC_PYTHON"))
    if RUNTIME_FILE.exists():
        add(RUNTIME_FILE.read_text(encoding="utf-8").strip())
    add(str(VENV_PYTHON))
    add(sys.executable)
    add("python3")
    add("python")
    for item in KNOWN_PYTHONS:
        add(item)
    return candidates


def python_has_modules(python_path: str, modules: tuple[str, ...] = REQUIRED_MODULES) -> bool:
    module_checks = [importlib.util.find_spec(module) for module in modules]
    if Path(python_path).resolve() == Path(sys.executable).resolve():
        return all(module_checks)

    probe = (
        "import importlib.util, sys; "
        f"mods={list(modules)!r}; "
        "sys.exit(0 if all(importlib.util.find_spec(m) for m in mods) else 1)"
    )
    try:
        completed = subprocess.run(
            [python_path, "-c", probe],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return False
    return completed.returncode == 0


def resolve_runtime_python() -> str | None:
    for python_path in candidate_pythons():
        if python_has_modules(python_path):
            return python_path
    return None


def persist_runtime_choice(python_path: str) -> None:
    try:
        RUNTIME_FILE.write_text(f"{python_path}\n", encoding="utf-8")
    except OSError:
        pass


def ensure_compatible_interpreter() -> str | None:
    if os.environ.get(ENV_FLAG) == "1":
        return sys.executable

    runtime_python = resolve_runtime_python()
    if not runtime_python:
        return None

    persist_runtime_choice(runtime_python)
    current_python = str(Path(sys.executable).resolve())
    if str(Path(runtime_python).resolve()) == current_python:
        os.environ[ENV_FLAG] = "1"
        return current_python

    env = os.environ.copy()
    env[ENV_FLAG] = "1"
    os.execve(runtime_python, [runtime_python, str(Path(__file__).with_name("doc_load.py")), *sys.argv[1:]], env)
    return None


def missing_dependency_message(module_name: str) -> str:
    lines = [
        f"缺少运行依赖: {module_name}。",
        f"当前解释器: {sys.executable}",
        "可执行的初始化命令: `bash scripts/setup.sh`",
    ]

    runtime_python = resolve_runtime_python()
    if runtime_python:
        lines.append(f"检测到可用解释器: {runtime_python}")
    else:
        lines.append("未检测到带所需依赖的 Python 解释器，请运行 setup.sh 初始化 skill 私有环境。")

    return "\n".join(lines)
