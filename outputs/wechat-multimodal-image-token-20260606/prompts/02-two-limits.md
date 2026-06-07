# 02 多模态图片的两类限制

Create a professional editorial infographic image in Chinese.

Aspect ratio: 16:9. Output should be a clean flat illustration, not a photo.

Style: modern magazine-style technology explainer, light gray background, near-black text, editorial blue and amber accents, clean vector shapes, structured layout, magazine-quality polish. No logos, no slide numbers, no footers.

Core message: 使用多模态模型时，图片要同时满足传输层限制和视觉处理层限制。

Layout: two-columns.

Visual composition:
- Left column: an API gateway box with an upload arrow and file size gauge. Label it "传输层限制".
- Right column: an eye / vision encoder frame with pixel grid and resize handles. Label it "视觉处理限制".
- A small image file icon sits before both columns, showing it must pass both checks before model inference.
- Use an understated warning badge for "大小 / 格式 / 长边像素".

Text elements in image, Chinese only:
- Title: "图片进模型前，要过两道关"
- Left heading: "传输层限制"
- Left bullets: "请求体大小", "单图体积", "Base64 膨胀"
- Right heading: "视觉处理限制"
- Right bullets: "最长边像素", "支持格式", "缩放策略"
- Bottom callout: "工程侧要先处理，不能把问题甩给用户"

Keep the graphic sparse, with clear two-column balance.
