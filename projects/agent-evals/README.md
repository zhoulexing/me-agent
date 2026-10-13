# agent-evals

独立的 Agent 评测项目，当前位于 `me-agent/projects/agent-evals/`。代码直接放在 `src/`，依赖、配置、SQLite、证据和报告均由本项目管理。项目通过 CLI 运行，不安装 Python 包、不构建 wheel。

当前版本提供可运行的 CLI：用例校验 → 重复执行 → 证据采集 → 确定性评分 → JSON/HTML 报告 → 对比、重跑、重判。业务 Prompt 未改动。**当前验证的是评测器和 YBA 接口协议；尚未完成真实 Agent 业务评测。**

## 快速运行

在本目录执行，Python 3.11 或更新版本：

```bash
uv sync --frozen
uv run python src/cli.py validate datasets/selftest/suites/smoke.yaml
uv run python src/cli.py validate experiments/selftest-golden.yaml --experiment
uv run python src/cli.py run experiments/selftest-golden.yaml
uv run python src/cli.py run experiments/selftest-broken.yaml
```

两组数据都是人工编写的**评测器自检数据**，不调用模型、不访问 YBA。每组包含问好、销售汇总、记忆偏好、任务授权、CSV 产物 5 个场景，每例重复 2 次：

- `golden`：预期 10 次全部通过，退出码 `0`。
- `broken`：预置空回复、错误销售数据、错误记忆、未经同意创建任务、错误 CSV，预期 10 次全部失败，退出码 `1`。

标准输出返回 `experiment_id` 和 HTML 报告路径；进度写入标准错误。定义或调用参数错误返回 `2`。报告明确标记模拟数据，不作为模型效果或发布门禁。

```bash
uv run python src/cli.py compare <golden-experiment-id> <broken-experiment-id>
uv run python src/cli.py inspect <trial-id>
uv run python src/cli.py report <experiment-id>
uv run python src/cli.py rerun <trial-id>
uv run python src/cli.py regrade <experiment-id>
uv run python src/cli.py cancel <experiment-id>
```

`inspect` 查看单次试验的执行状态、逐轮 Trace、评分与清理状态。Trial ID 可从执行进度或报告的原始 JSON 链接获得。`cancel` 由运行中的 CLI 在轮询时处理；它不是 YBA 端已取消的证明。

从其他目录调用时，把全局选项放在子命令前：

```bash
uv run --project /path/to/agent-evals python /path/to/agent-evals/src/cli.py --project /path/to/agent-evals --state-dir /path/to/eval-state run experiments/selftest-golden.yaml
```

## 文件归属

```text
agent-evals/
├── src/
│   ├── cli.py / config.py / models.py / service.py / version.py
│   ├── execution/               # 调度、Trial、前置校验、冻结输入
│   ├── adapters/                # fixture / YBA 与适配器工厂
│   ├── environments/            # 已准备环境的会话租约
│   ├── evidence/                # 用量统计、凭证脱敏
│   ├── graders/                 # 完成、回答、工具、状态、产物与汇总策略
│   ├── storage/                 # SQLite 与原子文件写入
│   └── reports/                 # 指标、对比、JSON 与 HTML
├── datasets/selftest/{cases,suites,fixtures}/
├── configs/targets/             # 目标连接配置，只引用凭证环境变量
├── experiments/                # selftest-golden / selftest-broken
├── tests/
├── docs/
├── pyproject.toml
└── uv.lock
```

所有定义中的路径相对项目根解析，不相对 YAML 文件所在目录；禁止通过 `../` 或符号链接读取项目外定义。

运行目录默认 `.agent-evals/`。如果项目已有 `.claw-evals/`，继续使用旧目录，保留历史结果和永久会话租约。覆盖优先级：`--state-dir` → `AGENT_EVALS_STATE_DIR` → 旧变量 `CLAW_EVALS_STATE_DIR` → 默认目录：

```text
.agent-evals/
├── evaluations.sqlite3
├── experiments/<id>/{manifest.json,report.json,report.html,fixtures/}
├── trials/<id>/{target.json,checkpoint.json,result.json,artifacts/}
└── regrades/<id>.json
```

`manifest.json` 冻结用例、实验、配置和模拟文件摘要；fixture 同时复制成实验快照。`checkpoint.json` 保存执行中的部分证据；完成后的 `result.json` 不覆盖。`rerun` 使用冻结的输入创建新实验，`regrade` 只用原证据追加一份当前内置评分器的结果，不执行模型、不更新原报告。当前未提供动态裁判版本或任意 Python 脚本加载。

## 编写用例

```yaml
schema_version: 1
case_id: greeting
version: 1
description: 问好时有回复且不创建任务
tags: [smoke]
turns:
  - user: 你好
limits:
  timeout_seconds: 120
  max_tool_calls: 20
graders:
  - id: runtime.completed
  - id: answer.nonempty
  - id: tools.forbidden
    params:
      names: [manage_automatic_task, "mcp__*__manage_automatic_task"]
```

`turns` 支持固定脚本的多轮输入，上一轮到达最终边界后才发送下一轮。同一 Trial 复用目标会话，不同 Trial 使用独立会话。只把 `user` 文本发送给 YBA，评分标准和参考答案留在评测端。

| 判分器 | 语义 |
| --- | --- |
| `runtime.completed` | 每例必填；所有轮次都有完整的最终 Query 记录 |
| `answer.nonempty` | 最后一轮的实际出站文本非空 |
| `answer.contains` | `all` 指定的文本全部出现，`none` 指定的文本不出现；不是语义裁判 |
| `tools.required` | 每个 `names` 模式匹配到一次工具调用；不证明调用成功 |
| `tools.forbidden` | 任一 `names` 模式匹配到工具调用即失败 |
| `state.equals` | 最终业务快照中的点分路径 `path` 等于 `value` |
| `artifact.csv` | 产物存在、摘要可信，且列名和每行内容符合预期 |

`names` 使用大小写敏感的完整名称匹配，支持 `*` / `?` 通配符；短名称不会自动匹配 MCP 全名。回复判分默认需要实际 `outbound`，显式设置 `source: assistant` 才评价 SDK 文本，此时不证明用户收到回复。

必选判分项出现失败则整例失败；没有失败但证据缺失则 `unknown`，不会记成通过。可选项使用 `required: false`，不影响整体判定。完整产物导出中没有文件是失败，文件导出不完整或收集后摘要改变是 `unknown`。

报告保留未知结果和分母，展示每次试验通过率、至少一次通过的用例数、全部重复都通过的用例数、耗时 P95 和用量。尚未计算置信区间或统计显著性。

`input_tokens` 表示 SDK 原始非缓存输入字段；`total_input_tokens` 为其加上缓存读取和缓存创建。`max_input_tokens` 按后者检查。多条 SDK 汇总可能重叠时用量保持未知，流式 usage 和子 Agent 汇总不重复相加。`sdk_total_cost_usd` 仅展示 SDK 上报值，不估算收费。预算在轮询时检查，无法保证目标绝不超限；YBA 取消能力缺失时尤其如此。

## 真实 YBA 接入

详见 [YBA 适配器协议](docs/adapters/yba.md)。先复制 `configs/targets/yba.example.yaml` 填写隔离测试实例、包含 Trace/最终边界能力的明确版本以及专用 session 路由，再编写引用该配置的实验。每个用例的每次重复都要有不同的 `session_key`，只换 `thread_id` 不够。

运行真实目标必须显式加 `--live`。该入口可能发送消息，只能连接准备好的测试通道；评测器不会为你建立或重置 YBA 实例。租约记录持久保留，不能把受过写入的会话当作干净环境重用。真实重跑必须指定新配置：

```bash
uv run python src/cli.py run experiments/my-yba.yaml --live
uv run python src/cli.py rerun <trial-id> --target configs/targets/fresh-yba.yaml --live
```

目前 YBA 适配器能够提交后台消息、按 Trace 读取本地记录并等待 `done_type=query`，但拿不到实际加载的 Prompt/Skill 快照、真实出站回执、业务状态或产物文件。因此不能通过当前接口完成全部 5 个业务场景验收，真实版本对比会标为需复核。

## 开发与当前边界

```bash
uv run pytest -q
uv run ruff check src tests
uv run ruff format --check src tests
```

当前采用单进程异步调度，外部 YBA 负责实际 Agent 执行。取消、超时和异常保留部分证据；进程被强杀时已落盘 checkpoint 可用于排查，但尚无自动接管、Worker 心跳与恢复机制。不要把本机 SQLite 当分布式队列。

已知凭证值和结构化敏感字段会在 YBA 证据落盘前脱敏，但不是通用个人信息检测器。用例和测试数据需事先脱敏，运行目录不进 Git；HTML 使用转义并禁止脚本执行。

后续按 [总体设计](docs/architecture.md) 补齐隔离环境准备与证据导出、真实模型基线、模型裁判和人工校准，再做管理界面与 CI 门禁。本版未创建自动任务，也未开启自动发布判定。

## 本次结构迁移与兼容

- 原 `src/claw_evals/` 已移除，导入直接使用 `models`、`execution.runner`、`adapters.base` 等；测试通过 `pyproject.toml` 的 `pythonpath = ["src"]` 加载源码。
- CLI 统一为 `uv run python src/cli.py <command>`。原已安装命令 `claw-evals` 和 `python -m claw_evals` 不再作为入口；所有子命令、参数和退出码保留。
- 原 `experiments/golden.yaml`、`experiments/broken.yaml` 和 `configs/*.yaml` 保留为指向新文件的符号链接，旧实验调用仍可使用。
- 5 个模拟场景整体移动到 `datasets/selftest/`，现有定义引用已同步；自定义定义中的旧 `datasets/yba/` 路径需要更新。
- 本次不改变证据 JSON、数据库结构和判分口径；运行产物仍由 `result.json` 保存证据，尚未新增独立 `evidence/bundle.json` 导出。
- 通用 Target/Variant/Environment 配置拆分、command 适配器、自动环境准备、模型裁判、管理页面和 CI 门禁属于下一步，当前未添加占位实现。
- 依赖版本和原锁文件的包索引保持不变，`pyproject.toml` 显式记录原包索引，避免源码运行时重新解析到另一来源。
