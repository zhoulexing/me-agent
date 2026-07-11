# Workflow details and failure modes

## Chinese transcript quality

- `hyperframes transcribe` is useful for model installation and non-Chinese audio.
- In HyperFrames 0.7.52, Mandarin can normalize into one giant item and contain `�`; reject that artifact.
- Direct `whisper-cli` must use `-nfa` when DTW timestamps are enabled. Without `-nfa`, flash attention disables DTW.
- Inject a glossary for product names, then still review the full text. Typical corrections include `Agent`, `Get 笔记`, `得到大脑`, `GetSeed`, and `Skill`.
- Compare the video with any same-topic article or speaker script, but do not silently replace spoken wording with polished article wording.

## Subtitle timing

- Map source time to output time through the EDL: `output = accumulated_previous_ranges + source_time - current_range_start`.
- Generate cue text only from `transcript-review.md`.
- Proportional phrase timing is acceptable for natural sentence captions when Chinese word timestamps are unreliable; verify representative cues against speech.
- Never split two-character words or English names across cues.

## HyperFrames composition

- Use muted `<video>` plus a separate `<audio>` element.
- Give every timed element `class="clip"`, `data-start`, `data-duration`, and `data-track-index`.
- Use dense keyframes on staged video so renderer seeks do not freeze.
- Full-screen explanation cards may intentionally occlude the video. Inspect real snapshots before accepting `text_occluded` info findings.
- The animation-map script can report false collisions when repeated elements share a selector; trust selector-specific real frames over collapsed bounding-box hints.
- Bundle a real Chinese font file when snapshot output reports a failed `local()` font. Do not ship proprietary fonts inside this skill.

## Caption fallback

Check `ffmpeg -hide_banner -filters | rg 'subtitles|ass'`.

- If available: burn reviewed SRT after the HyperFrames overlay render.
- If absent: render captions inside HyperFrames with a non-timed top layer, one caption visible at a time, and z-index above cards. Add an empty `caption-overrides.json` if the runtime requests it.

## QA interpretation

- Fix all lint/runtime/motion errors.
- Fix contrast warnings unless the element is an intentionally ignored decorative ghost.
- Review layout info findings in real snapshots; mark only proven intentional overflow/occlusion.
- Snapshot the first seconds, last seconds, every card hero frame, both sides of each cut, and several ordinary subtitle frames.
- Verify output duration against the EDL and confirm both H.264 video and AAC audio streams.

