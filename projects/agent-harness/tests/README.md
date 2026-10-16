# Tests

`session.test.js` 验证中断后的未知工具结果修复；`cli.test.js` 验证命令解析和工具展示，运行 `pnpm test`。`minimal-turn.live.test.js` 使用真实模型验证工具调用、轮次结束和计算结果；配置工程根目录的 `.env` 后运行 `pnpm test:live`。若网关也支持 Anthropic Messages，设置 `HARNESS_TEST_ANTHROPIC=1` 可增加该协议的工具与恢复测试。

`permissions.test.js` 验证批准前无副作用、参数冻结、取消、自动审核失败关闭、沙箱限制、解释器和子进程、网络、符号链接与硬链接、权限事件持久化和恢复。macOS OS 测试在其他平台明确跳过。CLI 另验证输入归属、EOF、取消与 JSON 模式。live 测试新增真实模型请求写入，经宿主批准回调后读回实际文件；这与终端人工点击验证分开。
