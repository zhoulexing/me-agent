# 飞书 CLI 与 Skill 完整指南

> 基于飞书官方实践整理

---

## 一、安装指南

### 1.1 安装飞书 CLI

```bash
npm install -g @larksuite/cli
```

### 1.2 安装飞书 Skill

```bash
npx skills add https://github.com/larksuite/cli -y -g
```

或者分开安装：
```bash
# 安装 CLI
npm install -g @larksuite/cli

# 安装 Skill（让 AI 知道怎么用这个 CLI）
npx skills add larksuite/cli --all -y -g
```

---

## 二、设计原则

### 2.1 CLI 设计原则（四大核心原则）

#### 原则一：Help 文本是最重要的文档

AI 遇到不认识的 CLI，第一件事就是运行 `--help`。

你的 help 文本就是工具说明书、参数规格、使用指南**三合一**。

不要写那种 `Usage: myctl deploy [flags]` 就完事的帮助信息，要写清楚每个参数干什么、什么时候用、有什么默认值。

飞书 CLI 还有一个 `schema` 命令，可以快速查询任何 API 方法的参数、请求体、响应结构、支持的身份和权限范围。AI 看到这些信息就能自己决定怎么调用。

#### 原则二：支持 dry-run

这是为 AI 设计的安全网。

AI 会自己做事，有时候它理解错了你的意图，或者匹配到了不该动的数据。dry-run 相当于一个"预览"机制。

举例：你让 AI 帮你删除飞书多维表里上个月的数据。如果直接执行，删错了就没了。加上 `--dry-run`，AI 会先跑一遍，返回类似这样的结果：

> "将要删除以下 47 条记录：2025-05 的过期任务 23 条，已归还项目 24 条。未做任何实际修改。"

你看了觉得没问题，再让它去掉 `--dry-run` 真执行。

Google 的 gws 也做了同样的设计，它的技能文件里甚至写了一条规则：对所有写入和删除操作，必须先 dry-run。

#### 原则三：错误信息能指导下一次操作

人看到 `Permission denied` 会自己去找文档。AI 看到 `Permission denied` 就愣住了。

飞书 CLI 的做法是：告诉 AI 你缺了什么权限，顺便把申请权限的命令也给出。比如 `lark-cli auth login --scope "calendar:calendar:readonly"`。AI 看到就能自己修复问题，继续干活。

为 AI 设计的 CLI，每一条错误信息都应该包含三个要素：
1. 哪个参数出了问问题
2. 具体错在哪里
3. 下一条应该执行什么命令来修复

#### 原则四：返回结构化数据，控制好输出量

飞书 CLI 支持 json、csv、table 等多种输出格式。
对人来说 table 更顺眼，对 AI Agent 来说 json 更可靠。

好的 CLI 不只是能跑通，还要方便被别的工具消费。同时要控制输出量。AI 的上下文窗口有限，如果一个命令返回一万行日期，上下文就炸了。

飞书 CLI 提供了分页参数（`--page-limit`）和过滤参数，让 AI 能拿到它需要的那部分数据就好。

---

### 2.2 Skill 设计原则

Skill 是给 Agent 看的说明书。它不干活，但告诉 Agent 这个 CLI 有哪些命令、什么场景该用什么参数、出错了怎么处理。

**简单说：CLI 是手，MCP 是另一种手，Skill 是肌肉记忆。**

没有技能文件 Agent 也能用 CLI，靠 `--help` 自己摸索。有了技能文件，Agent 一上来就知道该怎么操作，成功率高得多。

---

## 三、实际场景教程：让 AI 帮你自动化周会整理

### 场景目标

每周一让 AI 自动帮你完成：
1. 查询上周周会纪要
2. 提取待办事项
3. 创建新周会文档
4. 把待办转为飞书任务并分派给人

### 完整操作流程

#### 步骤 1：查询上周周会

```bash
lark-cli doc search --keyword "周会" --page-size 10
```

AI 会返回最近的周会文档列表。

#### 步骤 2：读取周会内容

```bash
lark-cli doc read <文档ID>
```

#### 步骤 3：提取待办（AI 自主分析）

AI 读取文档后，自动分析出待办事项：
- 谁负责
- 什么时候完成
- 优先级

#### 步骤 4：创建本周周会文档（dry-run 预览）

```bash
lark-cli doc create --title "2026年第13周周会纪要" --content "# 周会纪要\n\n## 上周待办回顾\n\n## 本周议题\n\n## 待办事项" --dry-run
```

预览创建效果，确认无误后去掉 `--dry-run` 正式创建。

#### 步骤 5：创建任务并分派

```bash
# 创建任务
lark-cli task create --title "完成 API 文档编写" --assignee "张三" --due "2026-04-05"

# 发送通知到群
lark-cli im send --chat-id <群ID> --content "本周周会已创建，待办已分派，请查看"
```

---

### 完整对话示例

```
你：帮我整理一下上周周会的待办，创建新的周会文档，并把待办转为任务分派给大家。

AI：（自动执行以下操作）

1. 查询周会文档
2. 读取文档内容，分析出 3 个待办事项
3. 创建新周会文档（dry-run 预览给你确认）
4. 确认后正式创建文档
5. 为每个待办创建飞书任务并分派人
6. 在群里发送周会通知

整个过程你只说了一句话，AI 在终端里跑了一串命令。
```

---

## 四、更多命令参考

### 4.1 日历相关

```bash
# 查看日程
lark-cli calendar agenda

# 查看下周张三有多少个会
lark-cli calendar agenda --user-id zhangsan --next-week | grep "张三" | wc -l
```

### 4.2 文档相关

```bash
# 创建文档
lark-cli doc create --title "项目报告" --content "# 报告内容"

# 搜索文档
lark-cli doc search --keyword "Q1 总结"
```

### 4.3 任务相关

```bash
# 创建任务
lark-cli task create --title "完成代码评审" --assignee "李四" --due "2026-04-01"

# 查看我的任务
lark-cli task list --assignee-me
```

### 4.4 消息相关

```bash
# 发送消息到群
lark-cli im send --chat-id oc_xxx --content "周会开始了，大家准备一下"
```

---

## 五、总结

| 原则 | 核心要点 |
|------|----------|
| Help 文本 | 清晰、完整、包含参数和默认值 |
| dry-run | 先预览再执行，安全可控 |
| 错误信息 | 包含修复建议，让 AI 能自助 |
| 结构化输出 | json 格式 + 分页控制 |

**让 Agent 动手之前，先让它 dry-run 一遍。**

---

*文档创建时间：2026-03-30*
