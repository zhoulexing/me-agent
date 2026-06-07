# 03 图片预处理兜底链路

Create a professional editorial infographic image in Chinese.

Aspect ratio: 16:9. Output should be a clean flat illustration, not a photo.

Style: modern magazine-style technology explainer, pure white background, near-black text, editorial blue primary accent, coral for lossy steps, emerald for success, amber for warning. Clean flow diagram, subtle separators, generous spacing. No logos, no slide numbers, no footers.

Core message: 好的智能体需要在模型前面做图片预处理：先尽量无损，再逐步牺牲质量和尺寸，最后才报错。

Layout: linear-progression.

Visual composition:
- A left-to-right pipeline with five stages.
- Stage 1: "PNG 无损压缩" with compression icon.
- Stage 2: "转 JPEG" with format swap icon.
- Stage 3: "降低质量" with quality ladder "80 / 60 / 40 / 20".
- Stage 4: "按比例缩放" with resize frame.
- Stage 5: "通过或报错" with split success/error terminal.
- Add a small note above the pipeline: "优先保清晰度，逐步兜底".

Text elements in image, Chinese only:
- Title: "模型前面的图片处理链路"
- Stage labels as above.
- Note: "先无损，再转格式，再降质量，再缩放"
- Final callout: "用户感受到的智能 = 模型能力 + 工程处理"

Make the pipeline visually calm and easy to scan.
