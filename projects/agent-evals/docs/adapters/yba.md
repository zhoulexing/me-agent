# YBA 远端 Pod 适配器

适配器通过远端 Pod 代理访问 YBA，必须指定完整 Pod ID；不再直连本地 YBA。不导入被测项目或 helper 的业务模块，不读取 ADE 的配置与 API Key，也不直接操作 YBA 数据库。

## 调用链与鉴权

默认使用 `pod_transport: admin`，复用 yzclaw-helper 当前的管理台链路：

```text
agent-evals
  → https://claw-admin.<环境>.qima-inc.com
  → /api/agent-pod-proxy/api/v1/agent-pods/<pod_id>/proxy/8080/api/...
  → 指定 Pod 内的 YBA HTTP 接口
```

环境为 `qa`、`pre` 或 `prod`，Pod ID 必须匹配环境。管理台地址只允许对应环境的 HTTPS claw-admin 域名。Cookie 从 `headers_env` 指定的环境变量，或明确配置的 `cookie_file` 读取。可以复用 helper 的 `.claw-cli/environments/<环境>/pod-cookie`，评测器不会自动读取浏览器、刷新登录或存储 Cookie。

另有 `pod_transport: service`，用于具备访问权限的内网运行环境，对齐 ADE 服务端的调用方式：

```text
agent-evals
  → 远端 Pod 服务 base_url
  → /api/v1/agent-pods/<pod_id>/proxy/8080/api/...
  → 指定 Pod 内的 YBA HTTP 接口
```

该方式从 `headers_env.Authorization` 指定的环境变量读取完整 `Bearer <API Key>`。两种方式都不经过 ADE 的 `/api/agent-pods/messages/notify` 入口；那个入口具有额外的 claw-auth Pod/会话签名约束，本适配器没有调用它。Cookie、Pod 服务 API Key 和 claw-auth 是不同鉴权方式。

源码核验依据：`yzclaw-helper/lib/pod/request.js` 的网关前缀和 Cookie、`lib/pod/proxy.js` 的 Pod 代理路径、`lib/config/environment.js` 的环境地址，以及 `ai-data-engine/app/service/agent-pod-service.ts` 的 `requestAgentPodProxy` 与 `buildPodProxyUrl`。

## 已核验的接口

原实现核验记录为 `master@4784488f9` 与 `hotfix/refactor-zlx_prompt@60f8dde88`，属于历史源码记录，不代表当前主目录或部署版本。实际被测 Pod 必须返回 `data.claw_trace_id`，并支持 Recorder 主 Query 的 `done_type=query`；缺少这些能力不能按完成处理。

### 提交一轮

`POST /api/messages/notify` 是 Pod 内路径；适配器会自动加上以上代理前缀。

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

`POST /api/messages` 同样通过指定 Pod 的代理调用。

```json
{"date": "2026-09-24", "session_key": "专用测试会话"}
```

返回 `data` 为 JSONL 文本。适配器按北京时间逐日读取、过滤 `claw_trace_id` 与 `thread_id`，以日期和行号作为事件定位；跨午夜查询会覆盖两天。未写完的末行暂缓解析，完整坏行记为协议错误。404 暂按未取得记录处理，继续等待；代理层也可能因 Pod 不存在返回 404，因此这不是目标健康或文件不存在的证明。

不传 `command`，不执行远端 shell。当前接口不提供分页或服务端 Trace 过滤；响应体超过配置上限就停止，不能静默截断成完整证据。

只有主 Query 的 `role=result, done_type=query` 才结束等待；`done_type=task` 和子 Agent Result 都不能提前结束。错误/中断终态分别映射为 `failed` / `interrupted`。没有支持的最终边界就等待到超时，不以“安静了一会”猜测完成。

Pod 内 Query 终态能证明其本地记录屏障，不代表远端上传已完成，也不代表 callbacks 已成功送达。适配器返回的 `completeness.outbound/state/artifacts` 仍为 false；不把 assistant 自称“已完成”转换成业务事实。

## 配置

主机上的默认配置示例见 `configs/targets/yba.example.yaml`，用户指定的 prod Pod 配置见 `configs/targets/yba.prod.example.yaml`，内网服务方式见 `configs/targets/yba-service.example.yaml`。示例默认未声明环境隔离、版本和会话，填写后才能运行真实评测。

```yaml
kind: yba
pod_environment: qa
pod_transport: admin
base_url: https://claw-admin.qa.qima-inc.com
pod_id: agent-pod-qa-youzan-business-assistant-your-test-pod
isolated_test_environment: true
declared_revision: your-deployed-commit
environment_revision: retail-fixture-v1
headers_env:
  Cookie: AGENT_POD_COOKIE
sessions:
  - session_key: dedicated-session-1
    thread_id: dedicated-thread-1
poll_seconds: 1
request_timeout_seconds: 15
max_response_bytes: 8000000
```

`admin` 方式省略 `base_url` 时，由 `pod_environment` 生成对应的 claw-admin 地址。复用 helper 缓存登录时，将 `headers_env` 改为 `{}`，并指定 Cookie 文件：

```yaml
headers_env: {}
cookie_file: /path/to/yzclaw-helper/.claw-cli/environments/qa/pod-cookie
```

Cookie 文件只在构造适配器时读取，内容不写入 manifest；路径应使用绝对路径或 `~/`。凭证环境变量不存在、Cookie 文件不可读、登录失效、响应为登录页面时立即报错。302/401/403 不跟随跳转、不自动刷新重发，尤其不能重发 notify。网络异常、无 Trace 和响应超限同样不会自动重试提交。

`service` 方式的鉴权配置：

```yaml
pod_transport: service
base_url: http://agent-pod.qa.s.qima-inc.com
headers_env:
  Authorization: YBA_POD_SERVICE_AUTHORIZATION
```

`YBA_POD_SERVICE_AUTHORIZATION` 应包含完整 Bearer 前缀；评测器不复制 ADE 的配置凭证。配置与 manifest 仅保存环境变量名或 Cookie 文件路径。地址不允许内嵌凭证、query 或路径，也不支持 localhost、回环地址或未指定地址；不会自动读取本机代理或 YBA 的 config.json。

按用例清单、重复序号为每个 variant 分配专用 session。租约以环境、Pod ID、session_key 标识；同一 Pod 经 admin 与 service 两种入口访问仍是同一个资源，不同 Pod 的同名会话可以独立使用。配置中的环境隔离是调用方声明，评测器无法单凭不同 session 验证店铺共享状态、远程记忆、定时任务、上传器和外部服务都已隔离。接入前必须在测试部署中准备相应数据和资源，不要把普通商家实例标记成测试环境。

版本同样是声明值，现有接口不能核验实际 Prompt、技能文件、工具 Schema、模型服务商路由或子 Agent 配置。报告因此不能直接输出发布通过结论。

## 接下来需要的通用能力

这些是后续接入需求，不是本版已经调用的端点：

1. 运行观测：实际加载版本与能力快照，以及可分页、可确认完整性的 Trace 导出。
2. 出站观测：复用 callbacks/outbound 的真实发送结果，包含文本、媒体及错误。
3. 受控证据：按运行授权导出产物内容、记忆和任务等业务状态，明确收集完成标记。
4. 生命周期：核验不确定提交、取消运行并确认已停止；隔离环境有独立准备、重置、回收流程。

这些能力由 YBA 通用观测接口或独立测试部署提供。评分、实验调度和报告继续留在 `agent-evals`，不在业务代码里引入评测依赖。

## 历史实验迁移

历史直连目标配置缺少 `pod_id`，需要改成远端 Pod 配置。旧证据仍可 inspect/regrade/report；旧 YBA Trial 使用 `rerun --live --target <新配置>` 时沿用冻结用例，使用新目标，不要求旧直连配置符合新 Schema。迁移需要新的隔离测试会话，旧直连租约无法从原 base_url 推断实际 Pod ID。

本次验证使用 MockTransport 核对完整代理 URL、请求体、Cookie/API Key、登录失效不重发、会话租约，以及现有终态/脱敏/预算契约。2026-10-14 使用全局 `claw-cli pod session metadata agent-pod-prod-youzan-business-assistant-43729418` 做了真实只读联通检查，响应包含 `success=true`、`code=ok` 和结构化 metadata。产物保存在 yzclaw-helper 的 `.claw-cli/artifacts/pod/agent-evals-43729418-metadata-20261014.json`。真实检查遵循 claw-pod 技能，通过 claw-cli 执行；评测器传输实现通过上述协议测试验证，尚未发起远端 notify 或进行真实模型评测。
