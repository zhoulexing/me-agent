#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/source.qt [edit-dir]" >&2
  exit 2
fi

SOURCE=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
EDIT_DIR=${2:-"$(dirname "$SOURCE")/edit"}

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null

mkdir -p "$EDIT_DIR/verify" "$EDIT_DIR/transcripts" "$EDIT_DIR/clips_graded"

ffmpeg -hide_banner -loglevel error -y -i "$SOURCE" -map 0 -c copy -movflags +faststart "$EDIT_DIR/source.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$EDIT_DIR/source.mp4" -vf "select='eq(n,0)'" -frames:v 1 "$EDIT_DIR/verify/first-frame.jpg"
ffmpeg -hide_banner -loglevel error -y -i "$EDIT_DIR/source.mp4" -vn -ac 1 -ar 16000 "$EDIT_DIR/transcripts/source-16k.wav"
ffprobe -v error -show_entries format=filename,format_name,duration,size,bit_rate -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels -of json "$EDIT_DIR/source.mp4" > "$EDIT_DIR/metadata.json"

echo "$EDIT_DIR/source.mp4"

