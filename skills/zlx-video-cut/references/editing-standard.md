# 自媒体口播视频剪辑标准流程

## 功能

把已有本地口播视频处理成适合小红书、抖音等平台发布的竖屏成片。默认目标不是大幅重剪，而是让视频更易看：

- 生成并烧录中文字幕
- 修正常见技术词识别错误
- 插入少量信息图卡片或图片式中场，降低纯口播疲劳感
- 保留自然语气，不把视频剪得过碎或生硬
- 做基础画面和音频优化
- 输出可直接发布的 MP4

## 适用触发

用户说以下需求时使用本流程：

- 剪辑这个视频
- 加字幕
- 中间插入图片/卡片/信息图
- 不要太生硬
- 做一个适合发小红书/抖音的视频版本
- 把口播视频包装一下

## 默认策略

### 优先使用本地 ffmpeg 流程

对已有视频做字幕、卡片叠加、淡入淡出、音频规范化时，优先使用本地流程：

```text
ffprobe / ffmpeg
+ faster-whisper
+ Python / Pillow
```

原因是它对已有素材最直接、稳定、可控，不需要把简单剪辑变成完整视频工程。

### 什么时候使用 HyperFrames by HeyGen

当用户明确希望中间图文更精致，或需求包含以下内容时，使用 HyperFrames：

- 动态标题卡
- 复杂转场动画
- 词语逐个高亮
- 章节动画
- 宣传片式包装
- 多段 HTML 动效合成

如果只是给已有口播视频加字幕和静态信息图卡片，不必默认使用 HyperFrames。

## 工作目录约定

不要改动原始视频。默认在当前工作区创建：

```text
video_edit_work/
  audio.wav
  transcript.txt
  subtitles_raw.srt
  subtitles_styled.ass
  subtitle_overlay.concat
  prepare_edit_assets.py
  assets/
    frame_01.png
    card_01.png
    subtitle_overlay.mov
    subtitle_overlays/
  output/
    <原文件名>_字幕卡片版.mp4
    check_*.png
```

如果用户给了多个视频，使用带日期或视频名的子目录，避免覆盖。

## 标准流程

### 1. 检查源视频

先确认视频参数、时长、分辨率、音轨：

```bash
ffprobe -hide_banner -i "<input_video>"
ls -lh "<input_video>"
which ffmpeg
```

记录关键参数：

- 分辨率，通常是 `720x1280` 或 `1080x1920`
- 时长
- 帧率
- 是否有音轨
- 文件大小

如果没有音轨，不能做自动字幕，需要先告知用户。

### 2. 提取音频

生成适合 Whisper 的音频：

```bash
mkdir -p video_edit_work/assets video_edit_work/output
ffmpeg -y -i "<input_video>" -vn -ac 1 -ar 16000 video_edit_work/audio.wav
```

### 3. 分析静音段

用静音检测判断是否适合删停顿：

```bash
ffmpeg -hide_banner -i "<input_video>" \
  -af silencedetect=noise=-35dB:d=0.8 \
  -f null -
```

处理原则：

- 只有少量 `0.8s-1.5s` 停顿时，不做大幅剪切，只做卡片和节奏包装
- 如果长停顿很多，再考虑剪掉明显空白
- 剪口播时保留一点呼吸，不要追求每句话都硬贴

### 4. 生成字幕

优先用 `faster-whisper`：

```bash
python3 -m venv .venv-video
.venv-video/bin/pip install faster-whisper pysubs2 pillow
```

转写脚本逻辑：

```python
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    "video_edit_work/audio.wav",
    beam_size=5,
    vad_filter=True,
    word_timestamps=False,
)
```

输出：

- `subtitles_raw.srt`
- `transcript.txt`

建议使用 `small` 模型作为默认。它比 `base` 稳，速度仍可接受。短视频需要更快时才用 `base`。

### 5. 修正常见识别错误

技术口播常见错词要做一轮替换。示例：

```text
clutter / clot -> Claude
托坑 -> token
scarce -> skill
系统题日词 -> 系统提示词
请求题 -> 请求体
响应题 -> 响应体
上下碗 / 上亚文 -> 上下文
节省文件 -> JSON 文件
每一人 -> 每一轮
```

不要过度改写字幕，优先修正明显错词和技术名词。无法判断的词保留原识别结果。

### 6. 渲染字幕层

如果本机 ffmpeg 有 `subtitles` 滤镜，可以直接烧 ASS 字幕。

先检查：

```bash
ffmpeg -hide_banner -filters | rg subtitles
```

如果没有 `subtitles` 滤镜，使用更稳的透明字幕层方案：

1. 用 Python + Pillow 把每句字幕渲染成透明 PNG
2. 用 ffconcat 拼成带 Alpha 的透明视频
3. 合成时 overlay 到原视频底部

字幕样式建议：

- 底部黑色半透明圆角底
- 白字，轻微黑色描边
- 字号按画面宽度自适应
- 最多两行
- 按像素宽度换行，不要只按字符数换行，避免英文术语被拆坏

### 7. 制作中间信息图卡片

卡片作用是让观众休息一下，同时强化结构。

默认做 3 到 6 张，不要太多。每张出现约 `3s`，淡入淡出，不中断原音频。

卡片内容来源：

- 从字幕或口播结构中提炼章节
- 每张只讲一个点
- 标题短，项目符号少
- 不写解释性长段落

卡片视觉建议：

- 从原视频抽帧做模糊背景，保持素材一致
- 前景放白色或浅色信息卡
- 使用清晰中文字体
- 不用复杂装饰
- 竖屏安全边距充足

抽帧示例：

```bash
ffmpeg -y -ss 00:01:12 -i "<input_video>" -frames:v 1 video_edit_work/assets/frame_01.png
```

Pillow 生成卡片时，推荐尺寸与原视频一致，如 `720x1280`。

### 8. 合成最终视频

合成内容：

- 原视频作为底层
- 信息图卡片按时间点 overlay
- 字幕透明层 overlay
- 音频 loudnorm
- 片头/片尾淡入淡出
- 输出 H.264 + AAC MP4

ffmpeg 合成逻辑示例：

```bash
ffmpeg -y \
  -i "<input_video>" \
  -i video_edit_work/assets/subtitle_overlay.mov \
  -loop 1 -t 3.2 -i video_edit_work/assets/card_01.png \
  -filter_complex "
    [0:v]format=yuv420p,eq=contrast=1.04:saturation=1.06[base];
    [2:v]format=rgba,fade=t=in:st=0:d=0.25:alpha=1,
      fade=t=out:st=2.85:d=0.35:alpha=1,setpts=PTS+70/TB[c1];
    [base][c1]overlay=0:0:enable='between(t,70,73.2)'[v1];
    [1:v]format=rgba[sub];
    [v1][sub]overlay=0:0,fade=t=in:st=0:d=0.2,fade=t=out:st=452:d=2[vout];
    [0:a]loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=452:d=2[aout]
  " \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart \
  "video_edit_work/output/<name>_字幕卡片版.mp4"
```

多张卡片时继续增加输入和 overlay 链。

### 9. 验收检查

输出后必须检查：

```bash
ffprobe -hide_banner -i "video_edit_work/output/<name>_字幕卡片版.mp4"
```

抽帧检查普通字幕段、卡片段、结尾段：

```bash
ffmpeg -y -ss 00:00:10 -i "<output_video>" -frames:v 1 video_edit_work/output/check_010.png
ffmpeg -y -ss 00:01:11 -i "<output_video>" -frames:v 1 video_edit_work/output/check_071.png
ffmpeg -y -ss 00:05:42 -i "<output_video>" -frames:v 1 video_edit_work/output/check_342.png
```

检查标准：

- 没有黑屏
- 字幕不越界
- 英文技术词没有被不自然拆开
- 卡片文字不被裁切
- 卡片和字幕不会严重遮挡
- 音画时长正常
- 文件大小合理

发现字幕越界时，优先改字幕渲染逻辑，而不是手工修某一句：

- 按像素宽度换行
- 降低字号
- 限制最多两行
- 对英文 token 做整体保留

### 10. 交付说明

最终回复用户时，给出：

- 输出 MP4 路径
- 做了哪些处理
- 是否保留原始视频
- 是否有未完全确认的风险，比如自动字幕可能有少量错词

示例：

```text
剪好了，输出在：
<output_path>

处理内容：
- 加了中文字幕并烧录进视频
- 插入了 5 张信息图卡片，带淡入淡出
- 做了轻微画面增强和音量规范化
- 原始视频没有改动
```

## 常见问题

### ffmpeg 没有 subtitles 滤镜

不要卡住。改用透明字幕层：

```text
SRT -> Pillow 透明 PNG -> ffconcat -> qtrle mov -> overlay
```

### Whisper 首次运行需要下载模型

如果网络被沙箱限制，按权限流程请求联网。不要跳过字幕质量检查。

### 字幕识别有明显错词

先看 `transcript.txt` 的开头、结尾和技术密集段。建立针对性替换表，再重新生成字幕层。

### 用户要求更精致的动画包装

切换到 HyperFrames：

- 用 HTML/CSS/GSAP 做章节卡片和重点词动画
- 渲染成透明或全屏视频片段
- 再用 ffmpeg 合回原视频

不要为了简单字幕叠加强行引入 HyperFrames。

## 本流程验证记录

2026-06-14：处理 7 分 35 秒竖屏口播视频，生成中文字幕、5 张信息图卡片、音频规范化和片尾淡出。第一次发现卡片段字幕英文换行异常，改为按像素宽度换行后重新合成，验收通过。
