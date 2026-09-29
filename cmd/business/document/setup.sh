#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_HELPER="$SCRIPT_DIR/../../auth/config.py"
VENV_DIR="$SCRIPT_DIR/.venv"
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"

MODULE_CHECK='import importlib.util, sys; mods=["langchain_community","httpx"]; sys.exit(0 if all(importlib.util.find_spec(m) for m in mods) else 1)'

declare -a CANDIDATES=()

add_candidate() {
  local value="${1:-}"
  local resolved=""
  if [[ -z "$value" ]]; then
    return 0
  fi
  if [[ "$value" = /* ]]; then
    [[ -x "$value" ]] || return 0
    resolved="$value"
  else
    resolved="$(command -v "$value" 2>/dev/null || true)"
    [[ -n "$resolved" ]] || return 0
  fi
  for item in "${CANDIDATES[@]:-}"; do
    [[ "$item" == "$resolved" ]] && return 0
  done
  CANDIDATES+=("$resolved")
}

python_has_modules() {
  local python_bin="$1"
  "$python_bin" -c "$MODULE_CHECK" >/dev/null 2>&1
}

python_has_pip() {
  local python_bin="$1"
  "$python_bin" -m pip --version >/dev/null 2>&1
}

pick_existing_runtime() {
  local python_bin
  for python_bin in "${CANDIDATES[@]:-}"; do
    if python_has_modules "$python_bin"; then
      printf '%s\n' "$python_bin"
      return 0
    fi
  done
  return 1
}

pick_bootstrap_python() {
  local python_bin
  for python_bin in "${CANDIDATES[@]:-}"; do
    if python_has_pip "$python_bin"; then
      printf '%s\n' "$python_bin"
      return 0
    fi
  done
  return 1
}

add_candidate "$(python3 "$CONFIG_HELPER" get documentPython)"
add_candidate "$VENV_DIR/bin/python"
add_candidate python3
add_candidate python
add_candidate /Users/zhouyuexing/miniforge3/bin/python3
add_candidate /opt/homebrew/bin/python3
add_candidate /usr/bin/python3

echo "=== 安装 zlx-cli doc 依赖 ==="

if existing_runtime="$(pick_existing_runtime)"; then
  python3 "$CONFIG_HELPER" set-document-python "$existing_runtime"
  echo "使用已有解释器: $existing_runtime"
  echo "=== 安装完成 ==="
  exit 0
fi

bootstrap_python="$(pick_bootstrap_python || true)"
if [[ -z "$bootstrap_python" ]]; then
  echo "未找到可用的 Python + pip 组合，无法初始化 zlx-cli doc 运行环境。" >&2
  echo "已检查的解释器: ${CANDIDATES[*]}" >&2
  exit 1
fi

echo "创建命令私有虚拟环境: $VENV_DIR"
"$bootstrap_python" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$REQUIREMENTS_FILE"

python3 "$CONFIG_HELPER" set-document-python "$VENV_DIR/bin/python"
echo "使用命令私有解释器: $VENV_DIR/bin/python"
echo "=== 安装完成 ==="
