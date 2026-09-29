# 上下文压缩后，Agent 为什么会把事做错？

假设你让一个代码 Agent 修支付模块的 Bug，并且明确说：“不要修改对外 API。”

Agent 查了代码，改了几个文件，测试还没跑完。就在这时，对话太长，系统压缩了上下文。下一轮，模型看到的摘要只有一句：“正在修复支付模块的问题。”

“不要修改对外 API”这条约束没了。Agent 为了让测试通过，顺手改了接口。代码能跑，任务却做错了。

这就是今天的问题：上下文压缩，究竟要保留什么，才能让 Agent 接着把事做对？

先看压缩怎么发生。Agent 运行久了，用户消息、工具结果和代码片段会不断占用上下文。接近模型窗口上限时，Harness 会把较早的对话整理成摘要，通常还会保留最近的一段原文，然后让 Agent 继续执行。

这解决了“装不下”的问题，但也改变了模型下一步行动的依据。早先那句“不要修改对外 API”，如果没有进入摘要，又不在保留的近期消息里，模型就看不到了。

所以，判断一次压缩是否成功，不能只看它省了多少 Token，还要看压缩后的 Agent 会不会做出不同的决定。

具体该保留什么？我会先抓四类信息。

第一，用户现在要完成的目标，以及后来对目标做过的修改。第二，不能违反的约束。像“不要修改对外 API”，不能只被概括成“注意兼容性”，因为这两句话对下一步操作的要求不一样。

第三，真实的执行状态：哪些文件已经改了，哪些测试已经通过，哪些只是准备去做。尤其要区分“计划运行测试”和“测试已经通过”。摘要一旦把两者写混，Agent 可能直接向用户宣布完成。

第四，是还没解决的问题和下一步动作。比如测试仍在运行，或者某个报错还没定位。压缩后，Agent 得知道该从哪里接着做。

这几类信息之外，大量重复的工具日志可以缩短。一次测试输出了几千行，模型未必需要重新读一遍；但它需要知道测试是否结束、结果是什么，以及必要时去哪里查原始输出。

Claude Code 的压缩提示词会要求摘要保留用户请求、用户反馈、文件改动和待办事项。DeepSeek Harness 的实现则会用摘要替换较早的对话，并保留近期消息。这些机制提供了延续任务的基础，但摘要仍可能遗漏或写错关键事实。

因此，做 Harness 时还要补两道工程检查。

一道是在压缩之后核对关键约束。对外 API 不能改，就检查实际文件差异；涉及权限的动作，就在工具执行前检查权限。不能因为摘要里写了“允许执行”，工具就直接放行。

另一道是在继续任务前核对运行状态。摘要说“测试正在运行”，工程系统就去查任务状态；摘要说“文件已修改”，就以当前文件为准。摘要负责帮助模型理解进展，真实状态仍要从文件、任务记录或外部系统中取得。

最后，怎么评测压缩有没有把 Agent 带偏？可以准备一组任务，在同一个节点分别让 Agent 使用完整上下文和压缩后的上下文继续执行。比较它们的下一步行动：是否仍遵守禁止修改的范围，是否重复操作，是否把未完成的事说成已经完成。摘要写得像不像原文，只能作为辅助指标。

上下文压缩真正要守住的，是 Agent 的行动连续性：目标还在，约束还在，已经发生的事实也没有被写成另一个故事。

---

## 附录：两个项目的压缩提示词

以下英文按本地源码整理。Claude Code 展示的是未传入自定义指令时，`getCompactPrompt()` 组装出的常规全量压缩提示词；它由禁用工具的前导语、主体提示词和末尾提醒组成，不含对话原文。Claude Code 另有局部压缩提示词，本附录不展开。DeepSeek Harness 展示的是 `COMPACTION_INSTRUCTION`，运行时作为回放对话后的最后一条用户消息加入；前面的系统提示词、工具定义和对话内容随会话变化。中文是对照译文，非项目源码。

- Claude Code 源码：[`src/services/compact/prompt.ts`](/Users/zhouyuexing/project/github/claude-code/src/services/compact/prompt.ts:19)，本地提交 `d079cf8`。
- DeepSeek Harness 源码：[`packages/compaction/compaction-basic/src/summarizer.ts`](/Users/zhouyuexing/project/github/deepseek-harness/packages/compaction/compaction-basic/src/summarizer.ts:30)，本地提交 `ddefc45fbc`。

### Claude Code：英文原文

```text
CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.

- Do NOT use Read, Bash, Grep, Glob, Edit, Write, or ANY other tool.
- You already have all the context you need in the conversation above.
- Tool calls will be REJECTED and will waste your only turn — you will fail the task.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.

Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests
   - Key decisions, technical concepts and code patterns
   - Specific details like:
     - file names
     - full code snippets
     - function signatures
     - file edits
   - Errors that you ran into and how you fixed them
   - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.

Your summary should include the following sections:

1. Primary Request and Intent: Capture all of the user's explicit requests and intents in detail
2. Key Technical Concepts: List all important technical concepts, technologies, and frameworks discussed.
3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable and include a summary of why this file read or edit is important.
4. Errors and fixes: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
5. Problem Solving: Document problems solved and any ongoing troubleshooting efforts.
6. All user messages: List ALL user messages that are not tool results. These are critical for understanding the users' feedback and changing intent.
7. Pending Tasks: Outline any pending tasks that you have explicitly been asked to work on.
8. Current Work: Describe in detail precisely what was being worked on immediately before this summary request, paying special attention to the most recent messages from both user and assistant. Include file names and code snippets where applicable.
9. Optional Next Step: List the next step that you will take that is related to the most recent work you were doing. IMPORTANT: ensure that this step is DIRECTLY in line with the user's most recent explicit requests, and the task you were working on immediately before this summary request. If your last task was concluded, then only list next steps if they are explicitly in line with the users request. Do not start on tangential requests or really old requests that were already completed without confirming with the user first.
                       If there is a next step, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no drift in task interpretation.

Here's an example of how your output should be structured:

<example>
<analysis>
[Your thought process, ensuring all points are covered thoroughly and accurately]
</analysis>

<summary>
1. Primary Request and Intent:
   [Detailed description]

2. Key Technical Concepts:
   - [Concept 1]
   - [Concept 2]
   - [...]

3. Files and Code Sections:
   - [File Name 1]
      - [Summary of why this file is important]
      - [Summary of the changes made to this file, if any]
      - [Important Code Snippet]
   - [File Name 2]
      - [Important Code Snippet]
   - [...]

4. Errors and fixes:
    - [Detailed description of error 1]:
      - [How you fixed the error]
      - [User feedback on the error if any]
    - [...]

5. Problem Solving:
   [Description of solved problems and ongoing troubleshooting]

6. All user messages:
    - [Detailed non tool use user message]
    - [...]

7. Pending Tasks:
   - [Task 1]
   - [Task 2]
   - [...]

8. Current Work:
   [Precise description of current work]

9. Optional Next Step:
   [Optional Next step to take]

</summary>
</example>

Please provide your summary based on the conversation so far, following this structure and ensuring precision and thoroughness in your response.

There may be additional summarization instructions provided in the included context. If so, remember to follow these instructions when creating the above summary. Examples of instructions include:
<example>
## Compact Instructions
When summarizing the conversation focus on typescript code changes and also remember the mistakes you made and how you fixed them.
</example>

<example>
# Summary instructions
When you are using compact - please focus on test output and code changes. Include file reads verbatim.
</example>


REMINDER: Do NOT call any tools. Respond with plain text only — an <analysis> block followed by a <summary> block. Tool calls will be rejected and you will fail the task.
```

### Claude Code：中文译文

```text
重要：只用文本回答。不要调用任何工具。

- 不要使用 Read、Bash、Grep、Glob、Edit、Write 或任何其他工具。
- 你需要的所有上下文都已包含在上面的对话中。
- 工具调用会被拒绝，并浪费你唯一的一轮机会；任务将因此失败。
- 你的整个回复必须是纯文本：先是 <analysis> 区块，再是 <summary> 区块。

你的任务是为截至目前的对话创建详细摘要，特别关注用户的明确请求和你此前采取的行动。
摘要应充分保留继续开发工作所必需的技术细节、代码模式和架构决策，避免丢失上下文。

给出最终摘要前，请用 <analysis> 标签包裹你的分析，以组织思路并确保涵盖所有必要内容。分析时：

1. 按时间顺序分析对话中的每条消息和每个部分。对每个部分，充分识别：
   - 用户的明确请求与意图
   - 你处理用户请求的方法
   - 关键决策、技术概念和代码模式
   - 具体细节，例如：
     - 文件名
     - 完整代码片段
     - 函数签名
     - 文件修改
   - 你遇到的错误以及如何修复
   - 特别关注用户给出的具体反馈，尤其是用户要求你改变做法的地方。
2. 再次核查技术准确性和完整性，充分覆盖每个必需的要素。

摘要应包含以下部分：

1. 主要请求与意图：详细记录用户所有明确的请求与意图。
2. 关键技术概念：列出讨论过的所有重要技术概念、技术和框架。
3. 文件与代码部分：列出查看、修改或创建的具体文件和代码部分。特别关注最近的消息；适用时包含完整代码片段，并说明读取或修改该文件的重要性。
4. 错误与修复：列出遇到的所有错误，以及如何修复。特别关注用户给出的具体反馈，尤其是用户要求你改变做法的地方。
5. 问题解决过程：记录已经解决的问题及正在进行的排查工作。
6. 所有用户消息：列出所有非工具结果的用户消息。它们对于理解用户反馈和意图变化至关重要。
7. 待完成任务：列出用户明确要求、但尚未完成的任务。
8. 当前工作：准确描述在请求生成摘要前正在进行的工作，特别关注用户和助手最近的消息；适用时包含文件名和代码片段。
9. 可选的下一步：列出与你最近正在进行的工作直接相关的下一步。注意，必须直接符合用户最近的明确请求，以及你在生成摘要前正在处理的任务。如果上一项任务已经结束，只有下一步与用户请求明确相关时才能列出。不要在未向用户确认的情况下开始不相关的任务，或重启很久以前已经完成的请求。
                   如果有下一步，请直接引用最近的对话，准确说明你正在处理什么、停在什么位置。这段引文应逐字保留，以免误解任务意图。

以下是输出结构示例：

<example>
<analysis>
[你的思考过程，确保准确、充分地覆盖所有要点]
</analysis>

<summary>
1. 主要请求与意图：
   [详细描述]

2. 关键技术概念：
   - [概念 1]
   - [概念 2]
   - [...]

3. 文件与代码部分：
   - [文件名 1]
      - [说明该文件为何重要]
      - [概述对该文件做出的修改]
      - [重要代码片段]
   - [文件名 2]
      - [重要代码片段]
   - [...]

4. 错误与修复：
    - [错误 1 的详细描述]：
      - [如何修复]
      - [用户反馈（如果有）]
    - [...]

5. 问题解决过程：
   [已解决的问题和仍在排查的问题]

6. 所有用户消息：
    - [非工具调用的用户消息详情]
    - [...]

7. 待完成任务：
   - [任务 1]
   - [任务 2]
   - [...]

8. 当前工作：
   [当前工作的准确描述]

9. 可选的下一步：
   [可选的下一步]

</summary>
</example>

请按上述结构，对截至目前的对话生成摘要，确保准确、全面。

上下文中可能还有其他摘要指令。如果有，请在生成摘要时遵循。例如：
<example>
## 压缩指令
总结对话时，请重点关注 TypeScript 代码修改，并记住你犯过的错误以及如何修复。
</example>

<example>
# 摘要指令
使用压缩时，请重点关注测试输出和代码修改。逐字保留读取过的文件内容。
</example>


提醒：不要调用任何工具。仅用纯文本回答：先是 <analysis> 区块，再是 <summary> 区块。工具调用会被拒绝，并导致任务失败。
```

### DeepSeek Harness：英文原文

```text
You are now acting as a compaction engine for this AI coding assistant. Condense the conversation ABOVE into a structured checkpoint that lets another model resume the work with no loss of essential context.

Output EXACTLY the Markdown structure below: keep every section, in order. Use terse bullets, not prose paragraphs. Write "(none)" for an empty section — never drop a section.

## Primary Request and Intent
- [the user's original and evolving goals; quote verbatim where the exact wording matters]

## Key Technical Concepts
- [technologies, frameworks, patterns, and conventions in play]

## Files and Code
- [exact path: why it matters, key changes or snippets]

## Errors and Fixes
- [error: how it was resolved, plus any related user feedback]

## Pending Jobs
- [explicitly requested work not yet completed]

## Current Work
- [precisely what was in progress at this checkpoint]

## Next Step
- [the single next action, directly in line with the most recent request, or "(none)"]

## Critical Context
- [decisions and their rationale, constraints, user preferences, open questions, data needed to continue]

Rules:
- Write concise English engineering prose. Preserve exact file paths, commands, error strings, identifiers, numeric values, function signatures, and syntax fragments.
- Capture user feedback and explicit instructions faithfully, especially corrections.
- Do NOT mention this summarization request or that the context was compacted.
- Output only the checkpoint text: do not call any tool or take any other action.
- If the conversation already contains a <compacted-summary> block, it is a PRIOR checkpoint. Do not copy it forward verbatim: preserve still-true facts, drop stale ones, and merge newer information into a single consolidated summary under the same structure.
```

### DeepSeek Harness：中文译文

```text
你现在是这个 AI 编程助手的上下文压缩引擎。将上面的对话压缩成结构化检查点，使另一个模型能够在不丢失关键上下文的情况下继续工作。

严格按照下面的 Markdown 结构输出：每个部分都必须保留，顺序不变。使用简短的条目，不写长段落。没有内容的部分写“(none)”，不要省略任何部分。

## 主要请求与意图
- [用户最初和后来变化的目标；准确措辞重要时逐字引用]

## 关键技术概念
- [涉及的技术、框架、模式和约定]

## 文件与代码
- [准确路径：重要性、关键修改或代码片段]

## 错误与修复
- [错误：如何解决，以及相关的用户反馈]

## 待完成任务
- [用户明确要求但尚未完成的工作]

## 当前工作
- [生成这一检查点时正在进行的具体工作]

## 下一步
- [与最近一次请求直接相关的单个下一步动作；没有则写“(none)”]

## 关键上下文
- [决策及其理由、约束、用户偏好、未解决的问题和继续工作需要的数据]

规则：
- 使用简洁的英文工程表述。保留准确的文件路径、命令、错误字符串、标识符、数值、函数签名和语法片段。
- 忠实记录用户反馈和明确指令，尤其是纠正意见。
- 不要提及这次摘要请求，也不要提及上下文已经压缩。
- 只输出检查点文本；不要调用工具或采取其他行动。
- 如果对话中已有 <compacted-summary> 区块，它是先前的检查点。不要逐字复制：保留仍然成立的事实，删除过时内容，并按相同结构将较新的信息合并成一份摘要。
```
