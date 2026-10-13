# YBA HTTP 适配器

适配器只通过 HTTP 访问被测系统，不读取父项目配置、不导入 `app.*`，也不直接操作 YBA 数据库。

## 已核验的接口

实现核验时，主目录为 `master@4784488f9`，第一期完成分支为 `hotfix/refactor-zlx_prompt@60f8dde88`。当前主目录的通知接口未包含 `data.claw_trace_id`，必须使用包含该返回值及 Recorder `done_type` 的目标版本。这里的提交号是本次源码核验记录，不代表部署中的实际版本。

### 提交一轮

`POST /api/messages/notify`

```json
{
  "session_key": "专用测试会话",
  "thread_id": "测试话题",
  "target": "agent",
  "channel_mode": "all",
  "message": {"type": "text", "text": "你好"}
}
```

可选 `model` 用于主 Agent 模型覆盖。成功返回必须有 `data.claw_trace_id`，后续记录以此关联。HTTP 成功只证明受理；不证明执行、回复或业务完成。

该入口来源是 BACKGROUND，与正常 USER 入站不同，不覆盖真实用户入站的鉴权、busy buffer 和打断行为。适配器使用 `channel_mode=all`，因为 `final` 模式可能跳过媒体发送，不能用于验证产物交付。测试部署必须使用专用通道及已准备的 session 路由。

接口没有已验证的幂等提交键，网络结果不明或响应缺少 Trace 时不自动重试。此时目标可能已经执行，需要人工检查并弃用该试验环境；仅重跑 CLI 不是安全恢复方式。

### 读取逐轮证据

`POST /api/messages`

```json
{"date": "2026-09-24", "session_key": "专用测试会话"}
```

返回 `data` 为 JSONL 文本。适配器按北京时间逐日读取、过滤 `claw_trace_id` 与 `thread_id`，以日期和行号作为事件定位；跨午夜查询会覆盖两天。未写完的末行暂缓解析，完整坏行记为协议错误。404 视为当日文件尚不存在。

不传 `command`，不执行远端 shell。当前接口不提供分页或服务端 Trace 过滤；响应体超过配置上限就停止，不能静默截断成完整证据。

只有主 Query 的 `role=result, done_type=query` 才结束等待；`done_type=task` 和子 Agent Result 都不能提前结束。错误/中断终态分别映射为 `failed` / `interrupted`。没有支持的最终边界就等待到超时，不以“安静了一会”猜测完成。

本地 Query 终态能证明本地记录屏障，不代表远端上传已完成，也不代表 callbacks 已成功送达。适配器返回的 `completeness.outbound/state/artifacts` 仍为 false；不把 assistant 自称“已完成”转换成业务事实。

## 配置

```yaml
kind: yba
base_url: https://your-isolated-yba.example
isolated_test_environment: true
declared_revision: your-deployed-commit
environment_revision: retail-fixture-v1
headers_env:
  Authorization: YBA_EVAL_AUTHORIZATION
sessions:
  - session_key: dedicated-session-1
    thread_id: dedicated-thread-1
poll_seconds: 1
request_timeout_seconds: 15
max_response_bytes: 8000000
```

Header 值仅从环境变量读取，值应包含服务所需前缀；配置与 manifest 仅保存变量名。地址不允许内嵌凭证。不会自动读取本机代理或 YBA 的 config.json。

按用例清单、重复序号为每个 variant 分配专用 session。配置中的环境隔离是调用方声明，评测器无法单凭不同 session 验证店铺共享状态、远程记忆、定时任务、上传器和外部服务都已隔离。接入前必须在测试部署中准备相应数据和资源，不要把普通商家实例标记成测试环境。

版本同样是声明值，现有接口不能核验实际 Prompt、技能文件、工具 Schema、模型服务商路由或子 Agent 配置。报告因此不能直接输出发布通过结论。

## 接下来需要的通用能力

这些是后续接入需求，不是本版已经调用的端点：

1. 运行观测：实际加载版本与能力快照，以及可分页、可确认完整性的 Trace 导出。
2. 出站观测：复用 callbacks/outbound 的真实发送结果，包含文本、媒体及错误。
3. 受控证据：按运行授权导出产物内容、记忆和任务等业务状态，明确收集完成标记。
4. 生命周期：核验不确定提交、取消运行并确认已停止；隔离环境有独立准备、重置、回收流程。

这些能力由 YBA 通用观测接口或独立测试部署提供。评分、实验调度和报告继续留在 `agent-evals`，不在业务代码里引入评测依赖。
