# zlx-cli

一个用于命令行结构验证的最小工程。

当前支持：

- `zlx-cli --help`
- `zlx-cli user`
- `zlx-cli schema`

核心约束：

- 帮助输出来自命令树
- `schema` 输出同一份命令树的 JSON
- 后续新增命令时，优先改命令树定义，不分散到多个地方

## 运行

```bash
cd 08-cli
node ./bin/zlx-cli.js --help
node ./bin/zlx-cli.js user
node ./bin/zlx-cli.js schema
```
