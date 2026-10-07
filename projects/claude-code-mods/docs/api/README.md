# 类型来源

`2.1.289/claude-code/index.d.ts`、`claude-code-tools/index.d.ts` 是本机全局 Claude Code **2.1.289** 在成功加载研究插件时写入 `.claude-plugin/types/` 的原样快照。首行标明版本。未复制本机 MCP 工具类型或私人配置。

插件自己的 `types/index.d.ts` 只声明其 progress 状态。API 不由项目自行模拟声明。`scripts/check.mjs` 优先采用宿主生成类型；缺失时从本快照恢复离线检查。后者只证明与2.1.289契约一致，不证明其他版本已加载或兼容。升级后先真实加载，再检查首行、重新 tsc/test/live。

官方来源（2026-10-04核对）：
- https://code.claude.com/docs/en/plugins/mods/create
- https://code.claude.com/docs/en/plugins/mods/overview
- https://code.claude.com/docs/en/plugins/mods/reference
- https://code.claude.com/docs/en/plugins/mods/events
- https://code.claude.com/docs/en/plugins/mods/api
- https://code.claude.com/docs/en/plugins/mods/test
- https://code.claude.com/docs/en/plugins/manifest-reference
- https://code.claude.com/docs/en/settings-reference#pluginconfigs

校准发现：实际动态工具输出必须是 string/内容数组；任意对象（包括 `{content:...}` 外包裹）被真实宿主拒绝。本工程使用 JSON 字符串，pure unpack 函数解析。fixture 测试不会替代这项真实宿主校验。静态状态声明必须是自包含 types contract，不能导入外部模块。

`claude plugin test` 下人工 stub 的 agent.spawn 返回 agentId 不保留为真正创建的身份；本套件只测试请求/拒绝，不把 fabricated ID 的回调当成真实子代理完成。
