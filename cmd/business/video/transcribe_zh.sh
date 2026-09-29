#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 /absolute/path/source-16k.wav /absolute/path/transcripts-dir [glossary]" >&2
  exit 2
fi

AUDIO=$1
OUT_DIR=$2
GLOSSARY=${3:-"Agent，AI，Get笔记，得到大脑，GetSeed录音卡，Codex，ChatGPT，Skill"}
MODEL="$HOME/.cache/hyperframes/whisper/models/ggml-large-v3.bin"

command -v whisper-cli >/dev/null
mkdir -p "$OUT_DIR"

if [[ ! -f "$MODEL" ]]; then
  echo "large-v3 model is missing. Run: npx hyperframes transcribe <video> --model large-v3 --language zh" >&2
  exit 3
fi

THREADS=${WHISPER_THREADS:-8}
whisper-cli \
  -m "$MODEL" \
  -f "$AUDIO" \
  -l zh \
  -t "$THREADS" \
  -nfa \
  -ojf \
  -sow \
  -ml 20 \
  -dtw large.v3 \
  --prompt "$GLOSSARY" \
  -of "$OUT_DIR/whisper-large-v3"

echo "$OUT_DIR/whisper-large-v3.json"

