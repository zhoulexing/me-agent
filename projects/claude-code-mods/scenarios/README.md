# 场景与可观察结果

`run.mjs <arm> <scenario>` 的 arm 是 baseline、1..8、all。进程 cwd 固定为 workspace；其他目录启动直接插件时，固定资料 IO 会失败关闭。

| 场景 | 可观察结果 | 模型/工具与影响 |
| --- | --- | --- |
| normal | OK；notebook.md，e7 还写 index.json | 三个固定资料工具；规则综合，无模型 |
| deny（all/e2） | STOP；已有笔记不改 | 外层中间件拒绝，第一个工具不运行 |
| error | STOP；已有笔记不改 | 固定故障触发 provider .catch，拒绝而不读备用资料 |
| mock（all/e2） | MOCK；已有笔记不改 | 外层短路，明确标记模拟结果；不得作证据 |
| cancel | CANCELLED；已有笔记不改 | 教学命令分支；不冒充真实按键中断 |
| status | switches/progress/pendingAgents | 不调用模型 |
| classify（3/all） | 标签建议或 api-error/aborted/empty-reply | F1 单次 haiku；20token、run脚本90秒（插件默认15秒），不含会话历史；写model-report.json |
| io（7/all） | 固定资料字节数 | 固定只读 wc，用户 args 不传入 shell |
| agents（4/all） | 启动请求已处理 | 两个一次性无工具子代理；交互 `/research-agents evidence` 可只启动一个；父会话须启用Agent；核对agents-report.json完成事件 |

真正主回合中断用 `/research-cancel`（immediate 命令）；fixture 测试核对 `$.turn.abort` 参数与 `turn.complete.isAborted`。实际终端 Escape/Ctrl+C、模型途中的中断尚未实测。

研究方法的 Skill 在 `plugins/research-notebook/skills/research-method/SKILL.md`。方法不需要 mods；同底座 baseline 只证明八个开关不破坏固定资料闭环，未证明 Skill 与 mods 的研究质量差异。

模型验证有界执行且不自动重试；终端入口 `npm run interactive`。本机分类返回网关server_error、子代理120秒未完成，详见coverage.md；启动成功不算完成。
