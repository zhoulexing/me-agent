# Agent 评测与持续进化

## 核心问题

> 如何证明某次模型或 Harness 改动真正改善了 Agent，而不是偶然跑得更好或只优化了表面指标？

## 深度课题

1. **评测对象到底是模型还是完整 Agent 系统**：明确 Model、Prompt、Context、Tools、Skills、Policy、Sandbox、Harness 和 Environment。
2. **如何构建能够代表真实任务分布的评测集**：平衡高频、高风险、长尾、失败案例、难度和数据泄漏。
3. **如何定义 Outcome 而不是评测 Agent 的最终话术**：以文件、数据库、API、副作用和用户目标作为真实结果。
4. **如何选择确定性 Grader、Trace Grader、LLM Judge 和人工评审**：比较客观性、偏差、成本和校准方式。
5. **如何评测 Agent 是否发生目标偏离**：检查行动关联、约束、范围扩张、有效进展和计划一致性。
6. **如何评测上下文污染和压缩失真**：覆盖错误 Memory、过期信息、Prompt Injection、噪声和约束丢失。
7. **非确定性 Agent 为什么需要多次 Trial**：研究 Pass Rate、Pass@k、方差、稳定性、成本分布和极端失败。
8. **如何区分模型提升和 Harness 提升**：通过单一变量实验、Run Manifest、A/B 和交互效应进行归因。
9. **如何控制基础设施噪声**：分离 Provider、网络、资源、并发、时间和外部服务状态。
10. **如何评测长任务、恢复和 Multi-Agent**：覆盖压缩、中断、副作用去重、Subagent、Background Job 和 Handoff。
11. **如何防止指标提升但真实能力没有改善**：处理 Goodhart、过拟合、Grader Hack、隐藏集和生产抽检。
12. **如何把生产问题转化成长期回归资产**：完成问题最小化、Fixture、Outcome、Grader、回归集和发布门禁。

## 面试级判断标准

优秀回答需要说明评测目标、环境、样本、证据、判分、统计和版本归因，不能只提出“多准备一些题让模型跑”。

## 建设顺序

先完成 Outcome、Grader 和 Run Manifest，再进入任务分布、目标偏离、基础设施噪声和持续迭代。每个课题应包含 TaskCase、Grader 或实验报告样例。
