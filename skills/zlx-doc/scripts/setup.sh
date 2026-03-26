#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== 安装 zlx-doc skill 依赖 ==="
python3 -m pip install -r "$SCRIPT_DIR/requirements.txt"
echo "=== 安装完成 ==="
