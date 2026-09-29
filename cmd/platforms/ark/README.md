# ARK 图片命令

统一入口：

```bash
zlx-cli ark image --mode text2img --prompt "一只可爱的猫咪"
zlx-cli ark image --mode img2img --prompt "修改后的描述" --image-url "https://example.com/image.jpg"
zlx-cli ark image --mode fusion --prompt "融合后的效果" --image-url "url1" --image-url "url2"
```

凭证从项目根目录 `.config/ark.json` 的 `apiKey` 字段读取。默认输出到 `.zlx-cli/images/`。
