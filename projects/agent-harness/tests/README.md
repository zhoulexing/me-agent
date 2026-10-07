# Tests

`session.test.js` 验证中断后的未知工具结果修复；`cli.test.js` 验证命令解析和工具展示，运行 `pnpm test`。`minimal-turn.live.test.js` 使用真实模型验证工具调用、轮次结束和计算结果；配置工程根目录的 `.env` 后运行 `pnpm test:live`。若网关也支持 Anthropic Messages，设置 `HARNESS_TEST_ANTHROPIC=1` 可增加该协议的工具与恢复测试。
