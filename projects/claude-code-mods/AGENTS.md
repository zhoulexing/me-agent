# claude-code-mods 工程约定

只维护本项目。不得导入或修改 ../claude-code、../agent-harness 或个人研究资料。
新增能力放在独立 plugins/<name>/，每个插件有自己的 manifest、hooks、tests。插件内相对导入不得越界；API 以运行宿主生成类型为准。
运行 npm run check（严格插件校验、全部插件 tsc、官方 fixture 测试）。真实验证另运行 npm run live；规则 CLI 子进程45秒上限；可选分类110秒（请求90秒），交互演示120秒。不要把 stub 测试标成真实模型/工具/UI绘制通过。
只研究固定合成 fixtures；产物放 workspace/。不要保存私有上下文、凭据或完整 API 错误。保持宿主 ask/deny，只收紧权限。
不提交或推送；不永久安装插件。新宿主版本重新生成类型，复跑矩阵，并更新 docs/coverage.md 的版本与实测边界。
