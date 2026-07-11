---
name: zlx-video-cut
description: Edit Chinese talking-head videos from `.qt`, `.mov`, or `.mp4` sources with a reviewed error-free transcript, burned captions, 3–5 second HyperFrames explanation cards, a first-frame title cover, safe speech-boundary cuts, and final visual/audio QA. Use when the user asks to 剪辑口播视频、生成无错字字幕、插入说明图、制作首帧封面，或复用 ZLX 的个人视频剪辑流程。
---

# ZLX Video Cut

Produce a finished portrait talking-head video while preserving the speaker's meaning. Treat transcript correctness as the primary quality gate; visuals follow the reviewed words.

## Hard rules

1. Keep every generated artifact under `<source-dir>/edit/`; never modify the source video.
2. Inspect and transcribe before proposing the cut. Wait for the user's plain-language strategy confirmation before changing the timeline.
3. Never burn raw ASR text. Create `transcript-review.md`, correct every term and character, then generate captions only from that reviewed file.
4. Never cut inside a word. Pad every cut edge by 30–200 ms and apply 30 ms audio fades to each extracted segment.
5. Extract each segment separately, then concatenate matching encoded segments with `-c copy`.
6. Apply captions as the final visual layer. If FFmpeg has `subtitles`, burn them after all overlays. Otherwise put captions in the highest HyperFrames z-index and verify them in real snapshots.
7. Keep explanation cards readable for 3–5 seconds. Reveal one independent idea at a time and hold the complete hero frame for at least 3 seconds.
8. Use the source video's first frame for the cover unless the user explicitly requests another frame.
9. Run HyperFrames lint/runtime/layout/motion/contrast checks, snapshot every card and cut boundary, and inspect the rendered output before delivery.

## Workflow

### 1. Prepare the footage

Run:

```bash
bash scripts/prepare_video.sh "/absolute/path/source.qt"
```

This creates the MP4 working copy, first frame, 16 kHz mono WAV, metadata, and standard edit directories. Read existing `<source-dir>/edit/project.md` before starting a new session.

### 2. Produce and review the Chinese transcript

Use large-v3 with a project glossary:

```bash
bash scripts/transcribe_zh.sh \
  "/absolute/path/edit/transcripts/source-16k.wav" \
  "/absolute/path/edit/transcripts" \
  "Agent，AI，Get笔记，得到大脑，GetSeed录音卡，Codex，ChatGPT，Skill"

python3 scripts/json_to_review.py \
  --input "/absolute/path/edit/transcripts/whisper-large-v3.json" \
  --output "/absolute/path/edit/transcript-review.md"
```

Read the entire review file. Compare it with any source article, script, product glossary, or user note. Preserve spoken wording and timing; fix only characters, punctuation, and confirmed terms. Ask about any unresolved proper noun.

Current HyperFrames 0.7.x can collapse Mandarin into one giant word and emit replacement characters. Use its transcription command to download the model if needed, but use the direct `whisper-cli -nfa -ojf -dtw large.v3` output as the Chinese timing source.

### 3. Confirm the edit strategy

Describe the intended trimming, target ratio, visual mood, subtitle treatment, card topics/times, cover, expected duration, and skill/output location in 4–8 sentences. Wait for confirmation.

Default ZLX visual direction comes from [assets/DESIGN.md](assets/DESIGN.md): warm paper, black ink, muted vermilion, heavy Chinese type, no blue-purple technology gradients. If the user supplies another visual reference, create a project `DESIGN.md` before composition HTML.

### 4. Build the EDL and base edit

Write `edit/edl.json` with source ranges, reasons, overlay windows, and expected duration. Prefer silence gaps of at least 400 ms. Extract each range with matching H.264/AAC settings and 30 ms audio fades, then concatenate with `-c copy`. Place a full-screen card over any visible internal jump cut.

### 5. Generate captions from the reviewed transcript

Use timestamp headings in the form `## MM:SS.cc–MM:SS.cc`, then run:

```bash
python3 scripts/build_subtitles.py \
  --transcript edit/transcript-review.md \
  --edl edit/edl.json \
  --output-json edit/captions.json \
  --output-srt edit/master.srt \
  --max-chars 16
```

Read every generated cue. Merge any cue boundary that splits a Chinese word or an English product name. Keep one group visible at a time, normally 8–18 Chinese characters and no more than two lines.

### 6. Build HyperFrames graphics

Use the HyperFrames and talking-head-recut workflows. Match the source aspect ratio by default; use 1080×1920 for portrait sources. Re-encode the staged input with dense keyframes (`-g <fps> -keyint_min <fps> -sc_threshold 0`).

Select cards from actual high-density ideas in the reviewed transcript. Each card needs explicit `startSec`, `endSec`, `intent`, `zone`, and exact on-screen copy. Use blur/fade transitions, entrance animation for every visible element, and a clean full-bleed video frame. Keep caption z-index above all cards.

### 7. Create the cover

Copy [assets/cover-template.html](assets/cover-template.html), stage `first-frame.jpg`, the local GSAP file, and an available Chinese font. Replace `{{TITLE_LINE_1}}` and `{{TITLE_LINE_2}}`. Snapshot the cover at a stable frame and export JPEG.

### 8. Verify and render

Run:

```bash
npx hyperframes doctor
npx hyperframes lint <project-dir> --verbose
npx hyperframes check <project-dir>
npx hyperframes snapshot <project-dir> --at <card-and-boundary-times> --no-end
```

Review all real snapshots. Then render a draft preview, inspect the start, end, every cut boundary, every card transition, and multiple subtitle cues. After fixes, render high quality at the source fps. Confirm duration, resolution, audio presence, and final frame count with `ffprobe`.

### 9. Persist the session

Append the strategy, decisions, reasoning, QA findings, and outstanding work to `edit/project.md`. Reuse cached transcripts unless the source file changes.

## References and assets

- Read [references/workflow.md](references/workflow.md) for failure modes and QA interpretation.
- Use [scripts/prepare_video.sh](scripts/prepare_video.sh) for deterministic preparation.
- Use [scripts/transcribe_zh.sh](scripts/transcribe_zh.sh) for production Chinese timing.
- Use [scripts/json_to_review.py](scripts/json_to_review.py) to create the review surface.
- Use [scripts/build_subtitles.py](scripts/build_subtitles.py) after manual transcript approval.

