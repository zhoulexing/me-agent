# CLI 工具收藏

记录好用的命令行工具及其用法。

---

## NotebookLM CLI

基于 Google NotebookLM 的命令行工具，支持管理笔记本、生成多媒体内容。

```bash
# 安装
pip install notebooklm_py playwright
playwright install chromium

# 登录
notebooklm login

# 常用命令
notebooklm list                          # 列出所有笔记本
notebooklm use <id>                      # 切换笔记本
notebooklm create "标题"                 # 创建笔记本
notebooklm ask "问题"                    # 向当前笔记本提问

# 添加来源
notebooklm source add <文件路径>          # 添加文件作为来源
notebooklm source add-drive <URL>        # 添加 Google Drive 文件

# 生成内容
notebooklm generate infographic "描述" --style scientific --language zh_Hans --wait
notebooklm generate audio "描述" --language zh_Hans --wait
notebooklm generate video "描述" --language zh_Hans --wait
notebooklm generate slide-deck "描述" --language zh_Hans --wait
notebooklm generate mind-map "描述" --language zh_Hans --wait
notebooklm generate quiz "描述" --language zh_Hans --wait
notebooklm generate report "描述" --language zh_Hans --wait

# 下载生成物
notebooklm download infographic <artifact-id>
notebooklm download audio <artifact-id>
notebooklm download video <artifact-id>

# 查看生成物列表
notebooklm artifact list
notebooklm artifact list --json          # JSON 格式输出

# 支持的信息图风格
# auto, sketch-note, professional, bento-grid, editorial,
# instructional, bricks, clay, anime, kawaii, scientific

# 语言设置
notebooklm language list                 # 查看支持的语言列表
# 中文简体: zh_Hans, 中文繁体: zh_Hant
```

---

## FFmpeg

音视频处理的瑞士军刀，支持转码、剪辑、合并、提取等几乎所有音视频操作。

- **安装位置**：`/opt/homebrew/bin/ffmpeg`
- **当前版本**：8.1
- **安装方式**：Homebrew（`brew install ffmpeg`）

```bash
# 查看版本
ffmpeg -version

# 查看媒体文件信息
ffmpeg -i input.mp4

# 视频转码（H.264 编码，CRF 23 质量均衡）
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a aac output.mp4

# 提取音频
ffmpeg -i input.mp4 -vn -c:a copy output.aac

# 视频剪辑（截取 10s-30s 片段）
ffmpeg -i input.mp4 -ss 00:00:10 -to 00:00:30 -c copy output.mp4

# 调整分辨率
ffmpeg -i input.mp4 -vf scale=1280:720 -c:a copy output.mp4

# 视频合并（需先创建 filelist.txt）
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4

# 提取视频中的帧为图片
ffmpeg -i input.mp4 -vf fps=1 frames/output_%04d.png

# 修复依赖问题
brew reinstall libvpx && brew reinstall ffmpeg
```

---

## yt-dlp

强大的命令行视频下载工具，youtube-dl 的活跃分支，支持 1000+ 视频网站。

- **安装位置**：`/opt/homebrew/bin/yt-dlp`
- **当前版本**：2026.3.17
- **安装方式**：Homebrew（`brew install yt-dlp`）

```bash
# 查看版本
yt-dlp --version

# 基础下载
yt-dlp <URL>                              # 下载视频
yt-dlp -f best <URL>                      # 下载最佳画质
yt-dlp -f "bestvideo[height<=720]+bestaudio" <URL>  # 限制最高 720p

# 只下载音频
yt-dlp -x --audio-format mp3 <URL>        # 提取音频并转为 mp3
yt-dlp -x --audio-format aac <URL>        # 提取音频并转为 aac

# 下载字幕
yt-dlp --write-sub <URL>                  # 下载字幕
yt-dlp --write-sub --sub-langs zh-Hans <URL>  # 下载中文字幕
yt-dlp --write-auto-sub --sub-langs en <URL>  # 下载自动生成的英文字幕

# 下载播放列表
yt-dlp <播放列表URL>                       # 下载整个播放列表
yt-dlp --playlist-items 1-5 <URL>         # 只下载前 5 个
yt-dlp --playlist-start 3 --playlist-end 10 <URL>  # 下载第 3-10 个

# 查看可用格式
yt-dlp -F <URL>                           # 列出所有可用格式

# 指定格式下载
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]" <URL>  # 指定 mp4 格式

# 代理设置
yt-dlp --proxy socks5://127.0.0.1:1080 <URL>

# 输出文件名
yt-dlp -o "%(title)s.%(ext)s" <URL>       # 用视频标题命名
yt-dlp -o "~/Downloads/%(title)s.%(ext)s" <URL>  # 指定下载目录

# 更新
yt-dlp -U                                 # 自更新到最新版本
```

---

## 飞书 CLI (lark-cli)

飞书官方命令行工具，支持文档、日历、任务、消息、多维表等飞书功能的命令行操作。专为 AI Agent 设计，具备 dry-run 预览、结构化输出、智能错误提示等特性。

- **安装方式**：npm（`npm install -g @larksuite/cli`）
- **安装 Skill（让 AI 知道怎么用）**：`npx skills add https://github.com/larksuite/cli -y -g`

**设计要点**：Help 文本即完整文档；所有写操作支持 `--dry-run` 预览；错误信息包含修复命令；支持 json/csv/table 输出格式及分页控制。

```bash
# 查看帮助（AI 遇到新 CLI 的第一步）
lark-cli --help

# 认证登录
lark-cli auth login --scope "calendar:calendar:readonly"

# --- 文档操作 ---
lark-cli doc create --title "标题" --content "# 内容"       # 创建文档
lark-cli doc create --title "标题" --content "内容" --dry-run  # dry-run 预览
lark-cli doc search --keyword "关键词" --page-size 10      # 搜索文档
lark-cli doc read <文档ID>                                  # 读取文档内容

# --- 日历操作 ---
lark-cli calendar agenda                                    # 查看日程
lark-cli calendar agenda --user-id zhangsan --next-week     # 查看他人下周日程

# --- 任务操作 ---
lark-cli task create --title "任务名" --assignee "张三" --due "2026-04-05"  # 创建任务
lark-cli task list --assignee-me                            # 查看我的任务

# --- 消息操作 ---
lark-cli im send --chat-id <群ID> --content "消息内容"      # 发送群消息

# --- API Schema 查询 ---
lark-cli schema <API方法>   # 查询任意 API 的参数、请求体、响应结构

# --- 输出格式控制 ---
lark-cli <命令> --output json         # JSON 格式（适合 AI 消费）
lark-cli <命令> --page-limit 20       # 分页控制，避免上下文爆炸
```
