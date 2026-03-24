# me-agent Scripts

这个目录包含 me-agent 项目的可执行脚本。

## 可用脚本

### ark_image_gen.py

ARK 图像生成 API 的 Python 封装工具。

**功能**：
- 文生图（text2img）：根据文本提示生成图像
- 图生图（img2img）：基于参考图像生成新图像
- 多图融合（fusion）：融合多张图像生成新图像

**使用方法**：

```bash
# 文生图
python ark_image_gen.py --mode text2img --prompt "一只可爱的猫咪"

# 图生图
python ark_image_gen.py --mode img2img --prompt "修改后的描述" --image-url "https://example.com/image.jpg"

# 多图融合
python ark_image_gen.py --mode fusion --prompt "融合后的效果" --image-url "url1" --image-url "url2"
```

**配置**：
- API Key 存储在当前目录的 `.env` 文件中
- 环境变量名：`ARK_API_KEY`

**输出**：
- 默认输出到 `../assets/` 目录
- 文件命名格式：`ark_{mode}_{index}.{ext}`

**详细文档**：参见 `../../../../04-个人技能/ark-image-gen/SKILL.md`
