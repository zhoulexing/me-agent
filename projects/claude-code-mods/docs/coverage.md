# 覆盖与验证记录

日期：2026-10-04；全局 CLI：**2.1.289**。本机原版本2.1.285；内置更新失败，沿 `command -v claude` 对应的 nvm 全局 npm prefix 完成官方更新。没有使用/修改 `projects/claude-code` 源码，没有修改 agent-harness、账号、认证或权限设置，没有提交/推送。

“已实测（真实CLI）”指最终插件在全局宿主加载并执行了相应动作。“已实测（fixture）”指官方 `claude plugin test` 的真实加载/中间件框架，但底层工具、模型、文件、时钟等使用显式 stub；它不证明真实模型、外部工具、终端绘制或管理员策略通过。“仅静态”指严格校验与宿主生成类型检查。八类只选代表能力，不是所有 API 清单。

## 八类介入点

| 实验 | 介入、读什么 | 改什么 | 失败方式 | 验证范围 |
| --- | --- | --- | --- | --- |
| e1 提示词/上下文 | prompt.submit、skill.prompt；仅 `[research]` 标记、指定 Skill 与固定三资料 | 追加方法/资料，保留既有 context | 读取异常由宿主跳过；固定资料工具另有拒绝守卫；此类不是安全策略 | context 保留、无标记不改：fixture；Skill 扩展仅静态；CLI单开闭环通过，但未执行真实提示词模型比较 |
| e2 工具/权限/结果 | tool.call、tool.check；固定资料ID和目标真实路径、下游决定 | trim/uppercase参数、提取摘要；mock明确标记且禁写笔记；只收紧权限 | 路径/加工/资料provider `.catch` 拒绝；无备用路径；ask/deny保留 | 参数、链接越界、ask/deny保持：fixture；normal/deny/error/mock：真实CLI；真实宿主用户权限弹窗未测 |
| e3 step/用量/取消/分类 | turn.start/step/complete；只读取step编号与token用量，保留stream | 统计step、状态；cancel调用turn.abort；分类是单次F1 complete | 分类无回答返回reason，策略拒绝不重试；取消分支不写笔记 | stream/用量/turn.abort/aborted/empty-reply：fixture；教学cancel分支：真实CLI；真实haiku先15秒aborted、再90秒上限请求约16.3秒api-error/server_error，eventAborted=false、usage=0；**没有分类成功证据**；真实代理进入step（steps=1），成功文本流和按键中断未测 |
| e4 会话/子代理 | session.append只计tool-result；agent.spawn、turn.complete匹配agentId | 注册证据/反例两个一次性、tools=[]、omitClaudeMd角色；显式命令启动；建议写agents.md | 只收集本插件返回ID；未知角色拒绝；失败不自动重启 | 角色注册及单证据agent.spawn：真实CLI，Agent工具启用后已返回agentId并进入step；120秒自动停止时仍pending=1；两次spawn请求/拒绝：fixture；完成路由与agents.md回调仅静态；**未验证真实子代理完成** |
| e5 命令/工具/配置 | session.start、config.set/describe；只针对本插件配置键 | 动态catalogue工具、命令清单、配置说明；会话内不放宽readOnlyIO | 注册异常宿主报告；固定研究底座没有自动allow；配置拒绝解释 | 命令/动态工具注册及运行：真实CLI；配置改写/拒绝、catalogue返回仅静态 |
| e6 终端UI | ui.render Spinner/AbovePrompt；公开进度与固定资料ID | spinner suffix、证据Text；e7时订阅progress状态 | 不替换宿主安全提示；其他组件传递 | 官方terminal元素树mount与查找：fixture；真实TTY显示AbovePrompt证据条及spinner suffix，/research-status返回steps=1、/exit关闭首个会话已测；像素/缩放布局、快捷键未测 |
| e7 状态/索引/定时/IO | state.get/set、store.get/set、fs、clock.every、固定process.run | 会话progress；资料指纹索引；每60秒检查，最多3次；固定wc可选 | 白名单与真实路径拒绝；timer失败只报状态；结束/reload停；不主动提交prompt | 状态/store/fs真实CLI通过；三资料指纹和10证据ID回查通过；变化检测/定时取消：fixture；固定wc：真实CLI；60秒真实定时、热重载和跨进程恢复未测 |
| e8 中间件组合 | 独立research-audit + 研究结果加工；tool.call前后、plugin.register能力名 | 独立计数、加工标记；依赖使audit在研究插件外层；可拒绝process能力插件 | `.catch` fail closed；后置审计看不到前置短路；处理后异常不重复next | 独立audit真实组合before=3/after=3/processed=3；普通依赖顺序已实测；前置短路不可见、异常、post-next不重跑：fixture；加载拒绝仅静态；管理员prepend/append未配置/未测 |

## 最终检查

- `node scripts/check.mjs`：两个插件 **strict validation通过**，两个插件 **tsc通过**，官方 fixture 测试 **36/36通过**（research32 + audit4）。运行失败码/输出fail双重检查。
- `node scripts/live.mjs`：**15/15真实CLI通过**：baseline + 单开1..8 + all；all下deny/error/mock/cancel/io。拒绝/异常/mock/cancel前后笔记hash不变。生成结果不冒充模型写作。
- all正常：`AUDIT before=3 after=3 denied=0 processed=3`；deny/error：before=1/after=1/denied=1；mock：before=1/after=1/processed=0；cancel没有工具调用。
- 产物 `workspace/notebook.md` 3929字节、`index.json` 530字节（首次最终组合）；3个SHA-256和10个证据ID与真实fixtures一致。后续生成时间/文本可能因实验arm变化。
- 可选真实分类：15秒尝试aborted后，诊断版90秒上限请求实际约16.3秒返回 `api-error/server_error`，status=null、eventAborted=false、所有usage=0。只重试了这一次较长有界诊断；未成功，不计模型通过。安全元数据见 `outputs/classification-report-90s.json`。
- 真实子代理：最初父会话只有Read时无法spawn；启用会话Read,Agent后，证据代理 `a41bc14b47eeb6a0e` 创建成功，真实turn.step触发、status显示steps=1/pendingAgents=1，120秒全进程上限停止时没有turn.complete，不计完成通过。未因超时重复付费启动。
- 真实终端：TTY中看到“合成证据 F1/F2/F3”、spinner进度、命令状态及子代理列表，操作过/research-status和/exit。检测到继承的bypass后立即关闭，重启显式default权限会话；脚本现统一default。只有当前TTY的最小功能实测。
- 环境阻碍：当前账号走已配置的公司LiteLLM网关；无凭据HEAD在沙箱内DNS失败，沙箱外TLS握手 `SSL_ERROR_SYSCALL`（exit35），不能用沙箱DNS错误单独归因。CLI也提示环境token与登录key同时存在；没有证据证明此提示导致server_error，未改变认证。用户/管理员先恢复公司网关网络/TLS并确认认证配置，再按README复跑分类及交互单证据代理。
- 本机机器结果在忽略的 `outputs/check-report.txt`、`outputs/live-report.json`、`outputs/model-ui-report.json`，只含固定场景摘要与计数。fixture文件来自本工程合成材料，没有真实用户研究正文。

## 未覆盖与限制

- baseline是同底座八开关关闭；未完成无插件/纯Skill与mods的模型质量盲评，不能推断准确率、成本或速度优势。
- 终端完整布局/快捷键、真实主模型stream/途中取消、真实子代理完成回调、真实分类成功、并发写入、timer真实时间和热重载恢复需后续专项验证。不会因为注册成功就把这些标为通过。
- 后台子代理只在会话保持打开时继续，`-p /research-agents`返回启动请求后进程可能结束；要测试完成需用README的120秒交互脚本运行（网关恢复后）并核对pendingAgents降为0及agents.md。
- `plugin.register`拒绝和prepend/append的强制保障依赖宿主排序/管理员设置。此工程未更改它们；不把普通用户插件当作管理员安全策略。
- 所有插件API能力以扫描清单可见，即使选项关闭，管理员能力审计仍可能拒绝含process.run的插件。此时最小用户操作是联系管理员确认允许本地脱敏实验，不能由本工程绕过。
- mods动态工具需要本机监听端口；Codex执行沙箱内端口被拒绝，获得已有授权范围内的沙箱外执行后真实矩阵通过。运行在用户普通终端不需本工程改权限。
- 若出现rollout缓存off，官方最小操作是联网启动一次全局claude再重试；远端仍关闭则等待宿主开放，不修改feature flags。
- 路径守卫只是教学保护；真实路径检查存在TOCTOU，不能防恶意mod、硬链接替换等。`$.fs`/`$.process`是宿主进程权限；它们不等于Claude内置工具的权限对话框。没有把原来ask/deny的内置工具自动允许。
- 固定规则综合只适用于这三份合成资料的当前语义。资料改变时timer标记待复查；修改fixture后应人工同步修订domain结论并重跑校验，不能把原模板结论当作自动新研究。
- store是宿主提供的持久键值空间；本项目只保存来源ID/文件名/hash/证据数量。不存session.messages或完整输入，不调用session.authorize/env/http，不打开完整debug日志。文件fs.write非原子，并发同workspace写入需额外设计。
