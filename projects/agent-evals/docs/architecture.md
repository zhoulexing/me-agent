# agent-evals 架构与迁移状态

当前项目根为 `me-agent/projects/agent-evals/`，Python 源码直接放在 `src/`，通过 `uv run python src/cli.py` 运行。独立管理依赖、配置、证据、数据库和报告，不导入被测项目的生产模块。

本次仅整理现有实现，保留执行、评分、存储和 YBA 接入语义。现有 5 个模拟业务场景移入 `datasets/selftest/`；它们验证评测器，不证明真实 Agent 质量。当前真实接入仍只有 YBA，已改为远端 Pod 代理：默认经 claw-admin 管理台网关与 Cookie，也支持内网 Pod 服务与 API Key。环境、Pod ID 和会话共同标识租约；不再本地直连。能力边界见 [YBA 协议](adapters/yba.md)。

## 模块职责

| 模块 | 本次整理的现有能力 |
| --- | --- |
| `cli.py` | 参数、输出、退出码；直接脚本入口 |
| `config.py` / `models.py` | YAML 加载、路径约束、现有数据契约 |
| `service.py` | 使用冻结输入重跑、使用原证据重判 |
| `execution/` | 并发、重复、多轮 Trial、预算、取消、输入快照与前置检查 |
| `adapters/` | 适配器创建、fixture 自检、远端 Pod 代理鉴权、YBA 执行与记录解释 |
| `environments/prepared.py` | 预先准备的测试会话租约身份，防止重用 |
| `evidence/` | 原有用量汇总与凭证脱敏 |
| `graders/` | 原有确定性判分，按完成、回答、工具、状态和产物拆分 |
| `storage/` | SQLite 元数据、永久租约、原子 JSON 写入 |
| `reports/` | 原有指标、对比、JSON 与静态 HTML |

执行链路：CLI → Service/Runner → 前置检查与输入冻结 → 环境租约 → Adapter → Worker 收集证据 → Grader → 存储与报告。YBA JSONL 解析留在 `adapters/yba/collector.py`；Runner 不解释 YBA 的 `done_type`。

## 保持的契约

- HTTP 受理、SDK Result、工具成功、Query 结束、出站与业务完成分别判断；YBA 仍等待主 Query 的 `done_type=query`。
- 多轮复用同一 Trial 会话，不同 Trial 使用独立租约；不确定提交不自动重发。
- 缺少必需证据保持 `unknown`；fixture 报告标记为评测器自检。
- 每个 Trial 结果只写一次；重跑创建新实验，重判追加记录。
- 数据库、`manifest.json`、`checkpoint.json`、`result.json` 与产物布局保持原结构。
- 默认新状态目录为 `.agent-evals/`，已有 `.claw-evals/` 继续使用，两个环境变量兼容。显式切换目录不会自动迁移旧会话租约，应保持真实目标的隔离资源不被重用。

## 通用架构的后续边界

目标设计围绕 Case、Suite、Variant、Experiment、Trial、Evidence 和 Grade。连接配置、实际 Agent 版本和测试环境分别管理；Agent Adapter 驱动执行，Environment Provider 管理资源，Evidence Collector 声明来源与完整性。

后续用例显式声明所需能力：目标不支持属于覆盖缺口，承诺支持但收集失败属于 `unknown`。自检、真实执行、历史重判分别展示。接入第二种真实 Agent 时，以只增加适配器、环境实现和用例为通用性验收标准。

本次尚未实现：通用配置拆分、能力预检、command 适配器、环境自动创建/回收、独立证据 Bundle、模型裁判、人工复核、管理 API、页面、分布式 Worker 和 CI 门禁。没有为这些能力创建空壳模块。测试组织暂时保留现有契约与操作测试，仅增加迁移回归测试。

原始 YBA 详细设计保留于 [历史设计与路线](yba-design.md)，其中提交号、包目录、接口草案和扩展模块属于原项目核验记录及后续设计，不代表当前部署或已实现能力。运行方式与实际目录以 [README](../README.md) 为准。
