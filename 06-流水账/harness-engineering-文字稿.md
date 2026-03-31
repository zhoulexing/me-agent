# Harness Engineering 文字稿

---

## 一、案例：让人们对 Harness Engineering 建立直观认知

在说理论之前，先看几个真实的案例。

**案例一：一个编辑工具的改进，让 15 个模型同时变强**

独立开发者 Can Duruk 发现了一个被很多人忽视的问题：Agent 修改代码的编辑器本身就是一个巨大的失败源。

当时业界主流的编辑方式有三种：OpenAI 的 apply_patch（要求模型生成特定格式的 diff）、Claude Code 的 str_replace（要求模型精确还原旧文本的每一个字符）、以及 Cursor 训练的专用 70B 合并模型。每种方式都有严重缺陷，Grok 4 使用 patch 格式的失败率高达 50.7%。

他设计了一种叫 **Hashline** 的新方案：当模型读取文件时，每一行都附带一个 2-3 字符的内容哈希标签。模型编辑时只需引用这些标签，而不是复现原始文本。

结果：16 个模型、3 种编辑工具、180 个任务、每个任务 3 次运行。Hashline 在几乎所有模型上都匹配或超越了传统方案。最极端的案例是 Grok Code Fast 1，成功率从 6.7% 飙升至 68.3%，十倍提升！输出 token 也下降了 61%。

**案例二：52 天独自生成 35 万行代码**

一位独立开发者在 52 天内用 AI Agent 独自构建了 35 万行生产代码。他发现了一个传统开发中不存在的现象：**技术债会被 Agent 指数级放大**。

当你做了一个临时补丁、绕过 Service 层直接查数据库、或者用一个硬编码的魔数，Agent 会把这个模式当作"范例"。下次生成类似功能时，就不是偶尔复用，而是系统性地复用。人类工程师遇到烂代码通常知道"这是地雷，绕着走"。Agent 不会，它看到代码库中存在某个模式，就把它当作合法方案。

技术债在线性累加的经典软件工程中可以被几个人模仿，但传播速度受限于团队规模和代码审查。在 Agent 协作开发中，技术债变成了自我复制的病毒：一个烂模式可以在几小时内被 Agent 复制到代码库的每一个角落。

**案例三：子 Agent 作为"上下文防火墙"**

HumanLayer 团队在大量企业级落地项目中发现了一个核心问题：Agent 的上下文窗口会随着工作推进而"腐烂"。每一次工具调用、每一次文件读取、每一次 grep 结果，都会在上下文中留下残渣。当上下文膨胀到一定程度，Agent 就进入了他们所说的"屎山分区"，即使简单任务也开始出错。

他们的解决方案不是"加大上下文窗口"，而是引入子 Agent 作为"上下文防火墙"：父 Agent 负责规划和编排，使用昂贵的推理模型（如 Opus）。子 Agent 在隔离的上下文窗口中执行具体任务，使用便宜的快速模型（如 Sonnet）。子 Agent 只返回高度压缩的结果 + 源码引用，中间过程不污染父 Agent 的上下文。父 Agent 始终保持在"聪明区"，可以跨越数十个子任务维持连贯性。

**案例四：反馈回路的重新设计**

HumanLayer 团队早期犯了一个看似合理的错误：每次 Agent 修改代码后，都运行完整的测试套件。结果 4000 行通过的测试输出涌入上下文窗口，Agent 开始对刚读到的测试文件产生幻觉，丢失了对实际任务的追踪。

他们的总结出一条直击灵魂的原则："成功应该是沉默的，只有失败才应该发出声音"。他们为 Claude Code 编写了一个 Hook 脚本：当 Agent 停止工作时，自动运行格式化和 TypeScript 类型检查。如果一切通过，完全静默，不向上下文注入任何内容。如果失败，则只输出错误信息，并用退出码告知 Harness 重新激活 Agent 去修复问题。

LangChain 的实践更近一步：设计了 PreCompletionChecklistMiddleware，在 Agent 试图提交时拦截它，强制它对照任务规格做一次验证。同时用 LoopDetectionMiddleware 追踪对同一文件的重复编辑次数，在 N 次后注入"也许你该换个思路"的提示，帮助 Agent 跳出死循环。结果是 LangChain 的编码代理在 Terminal Bench 2.0 测试中从 30 名跃升至前 5 名。

---

## 二、什么是 Harness Engineering？

**Harness Engineering**，中文可以叫"驾驭工程"或" harness 工程"，是一个让 AI Agent 高效、可控、可持续工作的系统性的工程框架。

这个词来自"harness"——也就是缰绳、马鞍和护具。AI 模型是强大的马，但因其黑箱属性具有不可控性；Harness 指的是缰绳、马鞍和护具，是工程管理学；骑手是人类工程师，明确意图、设计环境和构建反馈回路。

### Harness Engineering 包含哪些结构？

从上面的案例可以看出，Harness Engineering 主要包含以下几个核心组成部分：

**1. 记忆与上下文管理**
- 如何让 Agent 看到正确的信息
- 避免上下文窗口"腐烂"
- 子 Agent 架构作为"上下文防火墙"

**2. 工具调用与技能系统**
- 为 Agent 提供必要的工具和抽象层
- 定义哪些工具可用、哪些不可用
- 如 Hashline 方案就是一种编辑工具的重新设计

**3. 反馈回路设计**
- 成功应该静默，失败才应该发声
- 自动验证和检查机制
- 如 Hook 脚本和 PreCompletionChecklist

**4. 技术债管理**
- 将"品味"编码为自动化规则
- 定期扫描偏差、更新质量等级
- 建立类似"垃圾回收"的清理机制

**5. 架构约束**
- 严格定义模块间的依赖方向
- 通过自定义 linter 机械地强制执行
- 边界清晰，Agent 才能高效运行

---

## 三、Harness Engineering 与 Context Engineering、Prompt Engineering 的区别

| | Prompt Engineering | Context Engineering | Harness Engineering |
|---|---|---|---|
| **核心问题** | 怎么跟模型说话？ | 模型应该看到什么？ | 整个环境应该如何运作？ |
| **人类角色** | 用户，在固定的对话窗口里做文章 | Agent Builder，设计动态系统为 Agent 提供上下文 | 设计师，设计完整的运行环境包括约束、反馈回路、生命周期的治理等 |
| **关注点** | 单次交互、无状态、高度依赖个人经验 | 上下文从用户转向 Agent Builder，让模型更懂用户 | 角色再次从 Agent Builder 手里交到用户手里 |
| **本质** | 更像大师手艺，而非工程 | 系统性地设计、构建并维护一个动态系统 | AI 时代的操作系统和软件工程方法论的整体 |

三者的演进关系：
- **Prompt Engineering** 是最基础的阶段，关注如何写好提示词
- **Context Engineering** 进阶到关注如何管理上下文，Agent Builder 的角色变得重要
- **Harness Engineering** 则更进一步，关注整个环境的设计和治理

---

## 四、结语

Harness Engineering 的出现，是 AI 驾驭系统开始成形的信号。

笔者个人认为了解 Harness Engineering 能在在这个阶段引发共鸣，和 OpenClaw 的出现，促使 AI 主权从模型旁商转移到了用户侧有着紧密的关联。拥有了调试 Agent 的权利，也需要学会 Harness，懂得和 Agent 相处。

如果说过去我们是在训练 AI 做题，那么现在我们需要在设计一个可以让 AI 高效运转的系统。当模型的能力越来越强，当 Agent 的成本越来越低，真正的瓶颈不再是对模型的使用技巧，而是我们构建 Harness 的能力。

未来，属于那些懂得如何与 Agent 共舞的人。

---

*参考来源：*
- *[1] OpenAI: Harness Engineering: Leveraging Codex in an Agent-First World*
- *[2] Can Duruk: I Improved 15 LLMs at Coding in One Afternoon*
- *[3] HumanLayer: Skill Issue: Harness Engineering for Coding Agents*
- *[4] LangChain: Improving Deep Agents*
