#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install uv first: https://docs.astral.sh/uv/" >&2
  exit 1
fi

exec uv run uvicorn app.runtime:create_app \
  --factory \
  --host "${CC_AGENT_HOST:-127.0.0.1}" \
  --port "${CC_AGENT_PORT:-8080}"

