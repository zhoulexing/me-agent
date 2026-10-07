# Claude Code mods 实验工程

使用 Mac 全局 `claude`，独立维护多个插件，不依赖源码快照。已在 **Claude Code 2.1.289** 验证；mods 官方起点为 2.1.287+，API 仍属 early access。

研究案例读取三份固定**合成脱敏**资料，生成带证据编号、SHA-256、取舍、反例和待验证问题的笔记。默认是可复查的规则综合，明确标记非模型生成；可选分类和子代理建议不当作事实结论。

```sh
cd /Users/zhouyuexing/.openclaw/workspace/me-agent/projects/claude-code-mods
npm run check                  # 无模型/网络的官方 fixture 测试 + 严格校验 + tsc
npm run demo                   # 八开关组合，真实 CLI 写 workspace/notebook.md
node scripts/run.mjs 2 normal  # 单开实验2；1..8、baseline、all
node scripts/run.mjs all deny  # 也有 error / mock / cancel / status / io
npm run interactive            # 120秒有界终端体验（手动输入命令）
npm run live                   # 基准、八单开、组合及故障/只读IO矩阵
npm run new-mod -- my-mod      # 增加独立插件，不覆盖已有目录
```

需要 Node 22+、TypeScript 5.4+ 的 `tsc` 和可运行的全局 Claude Code。无需 npm 依赖安装。只使用会话 `--plugin-dir` 与临时 `--settings`，不写全局插件或权限设置。`pluginConfigs` 的值放在 `options` 下。规则 CLI 运行有45秒超时、2回合和0.15美元上限；分类 CLI 110秒（模型请求90秒），交互演示120秒和0.20美元上限。显式使用会话 `--permission-mode default`，不会继承 bypass；不修改全局权限。规则闭环本身不调用模型。

- `plugins/research-notebook/`：八个独立 `e1`…`e8` 开关；底座命令与固定资料服务一直存在。`baseline` 指八开关全关的**同底座对照**，不是没有插件的 Skill 盲评。
- `plugins/research-audit/`：独立审计，依赖关系使它位于研究插件之前；只记录次数，不保存工具输入。
- `fixtures/`：三份固定合成资料。`workspace/`：可覆盖产物；失败、拒绝、mock、教学取消不覆盖已有笔记。
- `scripts/`：发现所有独立插件并校验；`docs/api/2.1.289/` 是实际宿主生成的官方类型快照，不是手写适配器。宿主生成目录被忽略；无生成类型时 `check` 使用快照作离线类型检查。
- [实验范围与实测状态](docs/coverage.md)、[场景说明](scenarios/README.md)、[类型来源](docs/api/README.md)。

交互体验使用 `npm run interactive`，固定从 `workspace/` 启动。运行 `/research-run normal`、`/research-status`、`/research-audit-status`。输入包含 `[research]` 才注入资料上下文。`/research-cancel` 请求取消当前主回合及插件分类；`/research-agents evidence` 启动一个证据代理，`/research-agents` 启动证据与反例两个代理，均一次性、无工具、最多一回合，完成后写 `agents.md`。父宿主必须启用 Agent 工具，脚本只为该会话启用 Read、Agent，代理自身 `tools=[]`。`-p` 命令返回启动请求不证明代理完成。真实终端证据条、spinner 和命令交互已测；完整布局、缩放、按键中断未测。

可选 `node scripts/run.mjs 3 classify` 对 F1 调用一次 haiku（最多20输出token、90秒请求上限；插件默认15秒）；`node scripts/run.mjs 7 io` 只对 F1 执行固定 `/usr/bin/wc -c`。默认关闭。分类写 `workspace/model-report.json`，只含资料hash、模型别名、token上限、用量、耗时和失败代码；子代理 `agents-report.json` 记录启动及完成事件，不保存完整上下文。分类不自动重试。主回合与子代理使用现有账号；此工程不创建凭据、不改套餐。

本机真实分类约16.3秒返回 `api-error/server_error`，HTTP状态为空、未被取消、用量0；真实证据子代理已创建并进入step，但120秒未完成，演示自动停止。无凭据网关探测在沙箱外也出现 TLS 握手失败。这是模型成功和子代理完成验证的环境阻碍，不计通过。最小操作：由用户/管理员确认当前公司网关网络/TLS及账号认证配置（本机提示环境token与登录key同时存在，不断言它是原因）；恢复后运行分类命令及交互 `/research-agents evidence`，核对 `model-report.json` 的 `isAnswered` 和 `agents-report.json` 的 `turn.complete`。不需要购买、换套餐或由本工程修改认证。

**mods 不是安全沙箱。** `$.fs`、`$.process` 在宿主运行者权限下执行，固定 ID、真实路径/符号链接检查和输出白名单只是教学保护，有检查与使用之间的竞态；不能隔离恶意插件或阻止其他渠道读写。工具权限 hook 仅收紧，不把 ask/deny 改为 allow；管理员强制顺序没有在此配置。实验不读取私人上下文、账号配置或认证；日志只输出计数、状态、固定资料指纹，不开启完整 debug 日志。Claude Code 自身运行时记录与此项目日志不是同一系统。
