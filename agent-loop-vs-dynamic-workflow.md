# Agent Loop 与 Dynamic Workflow：Boris Cherny 的 Claude Code 模式

> 来源：Boris Cherny（Claude Code 创始人）在 2026 年播客、官方文档和社区分享中的论述整理
>
> 整理日期：2026-06-11

---

## 一、Boris Cherny 的工作方式全景

Boris 一个月 ship 259 个 PR，连续 47 天里有 46 天在跑 Claude Code，最长 session 跑了 1 天 18 小时。每一行代码都是 Claude Code + Opus 4.5 写的。

### 1.1 并行实例

- 本地终端开 **5 个 Claude Code 实例**，跑 **5 个独立的 git checkout**（编号 1-5，用系统通知区分哪个需要输入）
- 浏览器再开 **5-10 个 claude.ai/code session**
- 跨终端和浏览器的任务可以交接（handoff）
- worktree 隔离避免冲突

### 1.2 共享记忆

- 整个 Claude Code 团队共享一个 `CLAUDE.md` 文件，提交到 git
- Boris 不自定义 Claude Code，认为开箱即用已经够好
- 用 Opus 4.5 + thinking mode 跑所有任务："虽然更大更慢，但你需要更少地引导它、它的工具调用更好，所以几乎总是比用小模型更快。"

### 1.3 验证闭环

- Claude Chrome extension 自动测试 claude.ai/code 上的每个改动
- 工程团队从"写代码"转向"review + steering"
- "当工程师读 PR 时，代码已经处于良好状态"

---

## 二、Agent Loop（Boris 的原意）

### 2.1 Boris 的原话

> "I don't prompt Claude anymore. I write loops and the loops do the work. My job is to write loops."

> "You're not supposed to watch Claude Code work. You're supposed to wake up and review what it shipped."

### 2.2 它到底是什么

**Agent Loop = 你写一段循环代码（shell / Python / cron），反复以 headless 模式调用 `claude -p "..."`，让单个 agent 跑一遍又一遍。**

```bash
# 典型形态
while true; do
  # 1. 拉一个待办
  task=$(gh issue list --label ready-for-claude --json number,title -q '.[0]')
  [ -z "$task" ] && sleep 60 && continue

  # 2. 让一个 Claude agent 跑完一个完整回合
  claude -p "Fix issue #${task}. Run tests, open a PR, comment with the URL." \
         --allowedTools "Bash,Read,Edit,Grep" \
         --model opus-4-5

  # 3. 把这个 issue 标 done
  gh issue edit "$task" --add-label claude-fixed
done
```

### 2.3 关键特征

| 维度 | 含义 |
|---|---|
| 谁是循环 | **你写的代码**（shell、Python、`/loop` 调度器） |
| 单次循环的内容 | 一次完整的 agent session（读→想→调工具→结束） |
| 状态管理 | **每次循环是独立的 agent run**，不带上次 session 的 context |
| Context 怎么传 | 通过**文件 / git / issue / 数据库**等外部状态 |
| 典型时长 | 一晚 → 持续几天（Boris 最长 session 跑了 1 天 18 小时） |
| 成本 | O(N²) 累积（每次重读全部 history）→ 所以才要拆成多次短 run |

### 2.4 最小可运行版本

```bash
#!/bin/bash
# loop.sh —— 最小的 Agent Loop
# 每轮：起一个 headless Claude，让它干一件事，然后退出

for i in 1 2 3; do
  echo "=== Round $i ==="
  claude -p "在当前目录挑一个最简单的 TODO 注释，修掉它，跑测试，确认通过。"
done
```

**三件事：**
1. 外层是 `for` / `while`（**你写**）
2. 每次循环起一个独立 agent run（**`claude -p` headless**）
3. 每次循环结束就退出（**不保留 context**）

### 2.5 真实场景：自动消化 GitHub Issue

```python
#!/usr/bin/env python3
"""
fix_issues.py
Boris 风格的 Agent Loop：扫 GitHub issue → 起 Claude 修 → 开 PR → 标 done
"""

import subprocess
import json
import time
from pathlib import Path

# ---------- 关键设计：每次 loop 是一个独立的 agent run ----------
# 不传 context、不传 history、不传上次失败信息
# 所有"记忆"都落到 issue 评论 / git commit / 文件里

def gh(args: list[str]) -> str:
    """调 gh CLI，返回 stdout"""
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=True)
    return r.stdout.strip()

def run_claude_agent(issue_number: int, issue_title: str, issue_body: str) -> dict:
    """
    一次 agent run：让 Claude 读 issue、修代码、开 PR
    这是 Agent Loop 的"内层"——一次完整的 agent session
    """
    # 1. 把任务写到文件（不写在 prompt 里、也不传 history）
    task_file = Path(f".claude-tasks/issue-{issue_number}.md")
    task_file.parent.mkdir(exist_ok=True)
    task_file.write_text(f"""# Task: Fix issue #{issue_number}

## Title
{issue_title}

## Body
{issue_body}

## Constraints
- 只改必要的文件
- 跑 `pytest` 确认通过
- 用 `gh pr create` 提 PR
- 在 issue 下评论 PR 链接
""")

    # 2. 起一个 headless Claude
    # 关键：单次任务、单次 session、明确结束条件
    prompt = f"""
读取 .claude-tasks/issue-{issue_number}.md 里的任务，然后：
1. 探索代码、定位问题
2. 修复
3. 跑 pytest 确认通过
4. 提交一个 commit
5. 用 gh pr create 开 PR
6. 用 gh issue comment {issue_number} 留 PR 链接

完成后只输出一个 JSON：{{"status": "ok|pr_failed|tests_failed", "pr_url": "...", "summary": "..."}}
"""

    result = subprocess.run(
        ["claude", "-p", prompt,                    # headless 模式
         "--model", "opus-4-5",
         "--allowedTools", "Bash,Read,Edit,Grep",
         "--output-format", "json",
         "--max-turns", "30"],                      # 防止失控
        capture_output=True, text=True, timeout=1800
    )

    # 3. 解析结果（不解析就让 Claude 写文件，下次循环读文件）
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"status": "parse_error", "raw": result.stdout[-500:]}

# ---------- 外层循环：状态机由你控制 ----------
MAX_PER_NIGHT = 10
SLEEP_BETWEEN = 30   # 秒，避免 rate limit

def main():
    for round_idx in range(MAX_PER_NIGHT):
        # 1. 从外部状态（GitHub）取下一个待办
        next_issue = json.loads(gh([
            "issue", "list",
            "--label", "ready-for-claude",
            "--state", "open",
            "--json", "number,title,body",
            "--limit", "1",
            "--jq", ".[0] // empty"
        ]))

        if not next_issue:
            print("No more issues. Sleeping 5 min...")
            time.sleep(300)
            continue

        n, title, body = next_issue["number"], next_issue["title"], next_issue["body"]
        print(f"\n[Round {round_idx+1}] Issue #{n}: {title}")

        # 2. 标 in-progress（防止并发抢同一 issue）
        gh(["issue", "edit", str(n), "--add-label", "in-progress"])

        # 3. 起 agent（这是"一次"agent loop）
        result = run_claude_agent(n, title, body)

        # 4. 根据结果更新外部状态
        if result.get("status") == "ok":
            gh(["issue", "edit", str(n),
                "--remove-label", "ready-for-claude,in-progress",
                "--add-label", "claude-fixed"])
            print(f"  ✓ PR: {result.get('pr_url')}")
        else:
            gh(["issue", "edit", str(n),
                "--remove-label", "in-progress",
                "--add-label", "needs-human",
                "--add-comment", f"Claude couldn't fix this: {result.get('summary', 'unknown')}"])
            print(f"  ✗ Failed: {result.get('status')}")

        # 5. 让 rate limit 喘口气
        time.sleep(SLEEP_BETWEEN)

if __name__ == "__main__":
    main()
```

**跑法：**
```bash
# 睡前开 tmux 起这个循环
tmux new -s loop 'python3 fix_issues.py | tee loop.log'

# 第二天醒来 review loop.log 和 GitHub 上的 PR
```

### 2.6 关键设计原则

| 原则 | 为什么 |
|---|---|
| **每次 loop 是独立 session** | 避免 O(N²) token 累积；agent 每次都"清醒" |
| **任务写在文件里，不写在 prompt 里** | 文件就是 memory，git 就是审计日志 |
| **明确终止条件**（`--max-turns 30`） | 防止 agent 失控空转烧钱 |
| **状态机靠 issue label** | ready-for-claude → in-progress → claude-fixed/needs-human |
| **失败 = 标 needs-human** | 不重试同一任务（会浪费 token），留给早晨的人 |
| **速率限制** | `time.sleep(30)` 避免触发 API 限流 |

### 2.7 从"自己写循环"升级到"用 /loop"

Claude Code 内置了 `/loop` 帮你做调度：

```bash
# 在 Claude Code 交互式 session 里
/loop 每 5 分钟跑一次 `gh issue list --label ready-for-claude --limit 1`，挑第一个 issue 修掉跑通测试后开 PR，然后停
/loop 跑 pytest，失败就修，全过就 commit 并 push
/loop 每小时扫一次 PR 评论，回复或者改代码
```

`/loop` 的好处是 **prompt 里描述整个循环逻辑**，你不用维护 Python 脚本；坏处是循环中出错调试不如脚本直观。

### 2.8 Boris 真实的 loop 列表

```
1. /loop  每 5min 扫 inbox，把可自动处理的邮件归档
2. /loop  跑测试 → 失败就修 → 全过就 commit + push
3. /loop  扫 PR 评论，能用代码回应的自动回应
4. /loop  跑 linter + formatter，发现问题就改
5. /loop  监控 main 分支，rebase 落后太多的 feature 分支
6. /loop  把通过 CI 的 PR 自动 squash merge
```

**共同点：每个循环都是"读一个明确信号 → 做一件明确的事 → 退出"。** 这是 Agent Loop 区别于"长 session 自动驾驶"的关键。

### 2.9 反模式（不要这样写）

```bash
# ❌ 错：在外层循环里复用同一个 agent
claude -p "记住上一轮的结果，这一轮继续..."  # 没用！claude -p 每次是新 session

# ❌ 错：循环里塞太多任务
for i in {1..100}; do
  claude -p "把项目从 React 16 升到 React 19，跑通所有测试，部署"  # 一次不可能完成
done

# ❌ 错：没有终止条件
while true; do
  claude -p "看 GitHub 有什么新 issue 就修"  # 会一直膨胀直到 context 撑爆
done
```

**Agent Loop 的反模式 = 试图让一个 loop 干完整件大事。** Boris 的做法永远是**小事、快做、退出**。

---

## 三、Dynamic Workflow（Claude Code 官方特性）

这是 Claude Code 在 2026 年 1 月推出的正式功能（docs: `code.claude.com/docs/en/workflows`）。

### 3.1 官方对四层抽象的对比

| 抽象 | 它是什么 | 谁决定下一步 | 规模 |
|---|---|---|---|
| **Subagents** | Claude spawn 出的 worker | Claude，每轮 turn | 每轮几个 |
| **Skills** | Claude 遵循的指令 | Claude，照 prompt 做 | 同 subagents |
| **Agent teams** | 主管 agent 监督 peer sessions | lead agent，每轮 turn | 几个长跑 peer |
| **Workflows** | 运行时执行的脚本 | **脚本**（Claude 写的 JS） | **每次跑几十到几百个 agent** |

### 3.2 Boris 的话

> "Boris's tip: use dynamic workflows to have Claude orchestrate **hundreds or thousands of agents** on a single task."

> "/batch interviews you about a task, then **dynamically creates a workflow**."

### 3.3 它到底是什么

**Dynamic Workflow = 让 Claude 当场写一段 JavaScript 编排脚本，这段脚本再去 spawn 几十到几百个 subagent 并行干活。**

```javascript
// 这是 Claude 现场写出来的 orchestrator（伪代码）
// 重点：orchestrator 自己不消耗 model tokens

const tasks = await exploreCodebase();        // 找候选文件
const agents = tasks.map(t => spawnSubagent({  // 并行起 N 个 agent
  prompt: `Migrate ${t.file} to HttpClient wrapper`,
  tools: ['Read', 'Edit', 'Bash'],
  onFinish: result => writeReport(t, result)
}));

const results = await Promise.all(agents);

// Adversarial verify：再起一批 agent 互相攻击结论
const critics = results.map(r => spawnSubagent({
  prompt: `Try to break this migration: ${r.summary}`,
  mode: 'adversarial'
}));

const verified = await Promise.all(critics);
// 输出最终可信结论
```

### 3.4 关键洞察

> "A dynamic workflow is a short JavaScript program **Claude writes on the fly** to coordinate subagents. The agents do the work; **the code that coordinates them spends zero model tokens**."

—— `productcompass.pm` 整理的 Boris 演讲

| 维度 | 含义 |
|---|---|
| 谁是 orchestrator | **Claude 现场写出的 JS 代码** |
| Orchestrator 消耗 | 0 model tokens（只是 JS） |
| 谁决定 spawn 多少 agent | **代码**，不是模型 turn |
| "Dynamic" 在哪 | Claude 根据**实际任务**决定结构（多少 agent、怎么分配、要不要对抗验证） |
| 适用场景 | codebase-wide bug hunt、大规模迁移、安全/性能审计、高风险任务需要对抗性验证 |
| 触发方式 | `/batch <任务>`、`/deep-research <问题>`、`/simplify`、或开 `ultracode` 模式 |
| 与 Agent SDK 的区别 | SDK = 你**自己产品**里的 agent；Dynamic Workflow = **你工作中的** agent |

---

## 四、两者的本质区别

| | **Agent Loop** | **Dynamic Workflow** |
|---|---|---|
| 提出语境 | Boris 在播客里反复强调 | Claude Code 1 月正式发布的产品功能 |
| 循环的执行者 | **你**写的代码（外层） | **Claude** 写的 JS（内层） |
| 每次循环的尺度 | 一个完整的 agent run | 一个 subagent 任务 |
| 决策者 | 你（写循环逻辑时） | Claude（写编排脚本时） |
| 并行度 | 通常串行（一个 issue 一个 PR） | 高度并行（几十~几百个 agent） |
| 状态 | 外部存储（git / DB / issue） | 由 orchestrator JS 维护 |
| Token 经济 | O(N²)（每次重读 history）→ 拆短 run 缓解 | Orchestrator 零 token，子 agent 各算各的 |
| Boris 的比喻 | "我写循环，循环干活" | "让 Claude 编排成百上千个 agent" |
| `/loop` vs `/batch` | /loop 是 agent loop | /batch 是 dynamic workflow 触发器 |
| 适用心态 | **批处理**（一晚跑完一批 issue） | **横扫**（一次扫完整个 codebase） |

### 4.1 反转关系

两者的反转关系很有意思：
- **Agent Loop：代码包着 agent**（代码外，agent 内）
- **Dynamic Workflow：agent 包着代码**（agent 外，代码内）

---

## 五、两者搭配用

Boris 的实际工作流是**两者叠加**：

```
┌────────────────────────────────────────────────────┐
│  Agent Loop（你写的 /loop 调度器）                  │
│  ┌──────────────────────────────────────────────┐  │
│  │  每天凌晨跑一遍："处理所有 claude 标签的 issue" │  │
│  └──────────────┬───────────────────────────────┘  │
│                 ↓                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │  Dynamic Workflow（Claude 现场生成的 JS）       │  │
│  │   - 起 50 个 subagent 改 50 个文件              │  │
│  │   - 起 5 个 critic agent 互相验证               │  │
│  │   - 合并报告，开 PR                            │  │
│  └──────────────┬───────────────────────────────┘  │
│                 ↓                                   │
│           PR 等你早晨 review                         │
└────────────────────────────────────────────────────┘
```

---

## 六、一句话总结（修正版）

> **Agent Loop** = **你**写循环，让 Claude 一轮一轮跑（外层确定性，内层智能）。
> **Dynamic Workflow** = **Claude** 写循环，让几十几百个 subagent 并行跑（外层智能，内层并行）。

---

## 七、/goal vs Dynamic Workflows（深度 vs 宽度）

| | `/goal` | Dynamic Workflows |
|---|---|---|
| 范式 | 深度（depth） | 宽度（width） |
| 模式 | 设一个目标，单 agent 循环直到完成 | 并行多 agent 同时攻不同角度 |
| 适用 | 单一目标、可串行推进 | 需要广覆盖、多视角、需对抗验证 |

"动态"在 dynamic workflows 里指的是：orchestrator 可以**根据实际任务**决定 spawn 多少 agent、各自领什么任务。

---

## 八、为什么这个组合现在最有效

- **Opus 4.5 + thinking mode** 让"长 session 决策"成本更低
- **headless 模式**（`claude -p`）让 agent 可以被脚本调用
- **`/loop` / `/batch` / `/schedule`** 把循环本身也产品化
- **CLAUDE.md** 提供可版本化的共享 memory
- **worktree 隔离** 让并行不会冲突
- **adversarial verify** 让高风险任务也有质量保障

---

## 参考资料

- [The AI Agent Stack the Creator of Claude Code Uses - X/Avid](https://x.com/Av1dlive/article/2064292484856041558)
- [How Boris Uses Claude Code](https://howborisusesclaudecode.com)
- [Inside the Development Workflow of Claude Code's Creator - InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow)
- [Claude Code Dynamic Workflows Docs](https://code.claude.com/docs/en/workflows)
- [Introducing Dynamic Workflows in Claude Code - Reddit](https://www.reddit.com/r/ClaudeAI/comments/1tq9ofy/introducing_dynamic_workflows_in_claude_code)
- [Dynamic Workflows for PMs - Product Compass](https://www.productcompass.pm/p/claude-code-dynamic-workflows)
- [/goal vs Dynamic Workflows - MindStudio](https://www.mindstudio.ai/blog/claude-code-goal-command-vs-dynamic-workflows)
- [Claude Code Loops Ship While You Sleep - BuildMVPFast](https://www.buildmvpfast.com/blog/claude-code-loops-ship-while-you-sleep-2026)
- [Inside Claude Code: 13 Expert Techniques from Boris Cherny - Medium](https://medium.com/@tentenco/inside-claude-code-13-expert-techniques-from-its-creator-boris-cherny-d03695fa85b1)
- [Claude Code's Dynamic Workflows: The AI Agent Architecture - Medium/Illumination](https://medium.com/illumination/claude-codes-dynamic-workflows-the-ai-agent-architecture-that-just-rewrote-750-000-lines-of-code-d605a1d9b6d4)
