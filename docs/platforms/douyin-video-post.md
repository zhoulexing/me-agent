# 抖音视频发布

## 功能
通过 browser-use 将本地视频发布到抖音平台。

## 使用方式
```
发布抖音视频:
- 视频路径: <video_path>
- 标题: <title>（可选，不填则用默认值）
- 正文: <content>（可选，不填则只用固定标签）
```

## 默认行为

- **模式**：默认使用 headless 模式（无浏览器窗口），只有用户强调 `--headed` 时才显示浏览器
- **登录**：已通过 `--profile "用户1"` 复用 Chrome 登录状态
- **标签**：默认只有两个固定标签：`#人工智能` `#视频日记`，除非用户特别要求
- **确认**：发布前必须截图给用户确认，用户确认后才能点击发布

## 流程

### 1. 打开抖音创作者平台
```bash
browser-use --profile "用户1" open https://creator.douyin.com
```

### 2. 等待页面加载
```bash
sleep 3 && browser-use state
```

### 3. 点击"发布视频"
```bash
browser-use click 1282
```

### 4. 上传视频文件
```bash
browser-use upload 2827 "<video_path>"
```
> 上传后文件弹窗会自动关闭，进入发布编辑页面

### 5. 等待视频上传完成
```bash
sleep 5 && browser-use state
```

### 6. 填写标题
```bash
browser-use input <title_index> "<title>"
```

### 7. 填写正文内容（默认两个固定标签）
```bash
browser-use click <content_index>
browser-use input <content_index> "<content> #人工智能 #视频日记"
```

### 8. 截图给用户确认
```bash
browser-use screenshot "<保存路径>"
```

### 9. 用户确认后发布
```
等待用户确认后执行：
browser-use click <publish_index>
```

## 完整示例命令序列

```bash
# 1. 打开创作者平台
browser-use --profile "用户1" open https://creator.douyin.com

# 2. 等待页面加载
sleep 3 && browser-use state

# 3. 点击发布视频
browser-use click 1282

# 4. 上传视频
browser-use upload 2827 "/path/to/video.mp4"

# 5. 等待上传
sleep 5 && browser-use state

# 6. 填写信息
browser-use input <title_index> "AI时代，我在达芬奇里打字"
browser-use click <content_index>
browser-use input <content_index> "视频描述 #人工智能 #视频日记"

# 7. 截图确认
browser-use screenshot "/path/to/preview.png"

# === 等待用户确认 ===

# 8. 发布
browser-use click <publish_btn_index>
```

## 注意事项

1. **默认 headless 模式**：无浏览器窗口，更快更稳定
   - 只有用户强调时才用 headed 模式：`browser-use --headed --profile "用户1" open ...`

2. **每次操作前先 state**：页面元素索引可能变化

3. **视频上传需要等待**：大文件上传时间较长，用 `sleep 5` 或多次 `state` 确认

4. **固定两个标签**：正文默认 `#人工智能` 和 `#视频日记`

5. **发布前必须确认**：截图给用户看，用户确认后才能发布

6. **关闭浏览器**：
   ```bash
   browser-use close
   ```
