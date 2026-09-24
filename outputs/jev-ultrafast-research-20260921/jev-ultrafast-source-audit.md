# jev-ultrafast 源码调研

- 调研日期：2026-09-21
- 源码基线：`browser-use/jev-ultrafast@1231850a0bf1a0c0341fe408ef1668dbbfdfac46`
- 方法：README、核心源码、设计说明、测量数据、测试和公开 Issues 交叉核对；本地执行离线测试，结果为 31 passed。未调用付费 Jev API，也未复跑 Google Flights。

## 执行摘要

`jev-ultrafast` 的核心并不是“用一个更快的浏览器驱动替代 Playwright”，而是把浏览器 Agent 的每一步从自由文本生成改造成一个有界选择问题。Browser Runtime 先读取页面、筛选当前可见且支持的控件、分配代码拥有的元素编号并构造合法动作集合；Jev 只需选择动作类型和对应目标。动作类型与各类型的目标问题通过 TypeSafe 的 speculative fan-out 在一次请求中并行求值，代码只消费与最终动作相匹配的目标答案。[2][12]

Jev 不能生成要输入的任意字符串，因此当动作是 `TYPE_TEXT` 时，系统才调用第二个小型文本模型，要求它只返回 `{"text":"..."}`。浏览器执行仍由 Browser Harness/CDP 完成。换句话说，这个项目实际由四部分组成：DOM 观察器、动态动作空间、Jev 决策器和确定性 CDP 执行器，外加一个按需文本生成器。[1][2][4][5]

项目作为研究原型很有启发性，但不是 YBA 当前 Playwright MCP 的直接替代品。它没有 MCP Server、多租户会话、远程设备路由、授权审批或生产级独立成功验证。更合理的用法是提取它的 `observe → bounded choices → Jev choose → guarded execute → independent verify` 模式，放进 YBA 自己的 Browser Gateway。

## 一、单步到底如何运行

### 1. 页面观察：一次 CDP 调用生成结构化状态

`snapshot.js` 在页面中通过一次 `Runtime.evaluate` 遍历常见 HTML/ARIA 控件，仅保留可见、可交互、位于当前 viewport 的元素。它使用 `WeakMap` 给真实 DOM 节点分配身份，用 `Map` 保存节点引用；页面文字最多截取 6000 字符，动作最多保留 250 个，并补充 `SCROLL_UP`、`SCROLL_DOWN` 和 `WAIT`。[4][5]

这一步得到的不是截图，而是类似以下结构：元素角色、名称、当前值、勾选状态、节点身份、可执行动作和可见页面文字。库模式默认不截图；截图主要给 inspector 或录制使用。[1][7]

### 2. 动态动作空间：先由代码限制 Jev 能选什么

`action_space()` 将观察结果拆成两层选择。第一层是当前页面支持的 operation：`CLICK`、`TYPE_TEXT`、`SELECT`、滚动、等待、`DONE` 和 `BLOCKED`。第二层按 operation 分组：可点击元素只进入 `click_target`，可编辑元素只进入 `type_text_target`，原生下拉选项只进入 `select_target`。同一个 DOM 节点即使既可点击又可输入，也只拥有一个展示索引。[2][9]

这种设计把“不合法动作”从模型输出空间中删除。Jev 无法生成任意 CSS selector、坐标、JavaScript 或 Shell 命令；它只能选调用方提供的 option key。[2][5][13]

### 3. 一次 Jev 请求同时猜动作和多个目标

`choose()` 把 URL、标题、可见文本、元素表和最近十条动作放进 `state`，再构造一个 `operation` Choice 和若干 speculative target Choice。TypeSafe 文档明确说明，同一请求里的多个问题会并行计算，调用方可在收到结果后忽略无关问题。[2][12]

因此它不是先问“点还是输入”，再问“操作哪个元素”。它一次问完：下一步 operation 是什么；假设是 CLICK，目标是谁；假设是 TYPE_TEXT，目标是谁；假设是 SELECT，目标是谁。响应回来后，代码只校验并使用与最终 operation 对应的 target head，其他答案不能触发动作。[2][9]

### 4. TYPE_TEXT 才调用小型生成模型

当 Jev 选中 `TYPE_TEXT`，系统将原始目标、字段语义、最多 6000 字符页面文本及最近动作交给一个 OpenAI-compatible 文本模型。输出必须解析成只有 `text` 一个字段的 JSON，不能为空、不能超过 2000 字符；否则不输入任何内容。[2][6]

README 的录制配置使用 `inception/mercury-2.5`，但源码默认配置仍是 `deepseek-chat`；因此“使用哪个小模型”是部署配置，不是 Jev Ultrafast 算法的固定部分。[1][2]

### 5. 执行前重新验证，防止陈旧决策和双击

Agent 在任何 mutation 或文本模型调用前先消费 decision，使重试不能再次执行同一次点击。执行器重新检查页面指纹、目标节点身份、字段状态、附近 form/dialog/row 语义、可见性、禁用状态、当前位置和遮挡。点击通过 CDP MouseEvent，文本通过 select-all 后 `Input.insertText`，原生 select 则设置 option value 并触发 input/change。[3][5]

动作执行后先记账，再重新 observe。这样即使点击触发导航、后续观察失败，历史记录也不会把已经发生的动作误当作未发生。三次非 WAIT 动作都没有页面变化时，循环会进入 blocked；单次运行最多 60 个浏览器动作和 120 个决策请求。[3][6][7]

## 二、为什么会快

速度来自系统结构而非单一模型：默认不传截图；页面状态一次 CDP 读取完成；动作与各操作目标在一次 Jev 网络请求中并行决策；只有输入文本才调用生成模型；普通交互只等待最多两个 animation frame 或 50ms，combobox 等候可见建议最多 200ms。[1][5][12]

官方仓库记录的 Google Flights 演示为 7.073 秒，包含 17 次 Jev 请求、11 次浏览器动作和 2 次文本生成。六次交替运行中，两组都是 3/3 通过，优化版中位数从 9.450 秒降到 7.092 秒，浏览器协议调用中位数从 1092 降到 101。仓库同时明确承认样本只有一个任务、三个配对，不能视为通用可靠性基准。[8]

## 三、它不等于“不会出错”

代码验证 Jev 返回的 choice 必须属于候选集合，概率 key 必须完整、概率有限且和接近 1，最终 choice 必须是最高概率项。这个机制能消除格式错误和任意 selector，但不能保证所选合法动作在语义上正确。[2]

更值得注意的是，当前代码虽然记录 operation confidence 和 target confidence，却没有根据置信度暂停、升级或要求人工确认；只要响应结构合法，就会执行选中的动作。[2][3] 因此 TypeSafe 所说的“类型安全”应理解为不会产生 schema 外动作，而不是业务结果必然正确。

`DONE` 同样只是一个模型选择。Flights 示例另写了 verifier，检查页面 URL、单程、出发地、目的地、日期和真实结果；仓库设计文档也明确要求独立验证。[7][10]

## 四、当前工程边界

当前 MVP 只覆盖常见 HTML/ARIA 控件，不完整支持 accessible-name，不遍历 shadow root 和 frame，也不支持 canvas、上传、弹窗新 Tab、嵌套滚动及复杂键盘控件。[7][8]

动态动作空间同时也是它最大的风险：如果 Runtime 没暴露正确元素，Jev 无论多聪明都选不到。公开 Issue #23 报告了一个非原生 autocomplete 行没有进入元素表，Agent 因而重复填写直到耗尽动作预算的案例。[16] Windows 后台 Tab 的渲染节奏也被报告会产生空元素表并提前 `BLOCKED`。[17]

延迟对正确率也有二阶影响。公开 Issue #85 的外部测量显示，决策网络耗时变长时，页面更可能在 Jev 返回前改变，结果不仅慢，还会产生更多 stale decision 和额外请求。[18] 这些是用户报告，不等于维护方确认的普适结论，但与源码的 freshness/retry 机制一致。

## 五、对 YBA 的结论

建议复用模式，不要直接引入整个项目替换 Playwright MCP。YBA 可以先保留 Playwright 或未来的 Browser Harness 作为执行器，在其上构建统一的 `BrowserObservation` 和有限动作协议，再让 Jev 只负责 operation/target 选择。这样同一决策层可用于服务器 Chromium，也可用于 Electron 的 `webContents.debugger`。

生产化前至少需要补齐：每个动作的风险分类和授权；置信度阈值与升级策略；独立完成验证；多会话和设备隔离；可观察性和回放；敏感页面文本外发控制；iframe/shadow DOM/上传等业务需要的动作覆盖；本地浏览器离线和 stale-page 错误语义。

第一阶段适合只做服务器侧、只读或低风险任务的 A/B 验证，比较成功率、p50/p95 时延、步骤数、stale decision 比例、API 成本和独立 verifier 通过率。只有这些指标稳定后，再接入 Electron 本地执行域。

## 局限

本调研没有 TypeSafe API Key，因此没有独立复跑付费 Jev 决策或官方 Flights 演示。性能数字来自仓库提供的原始测量文件；模型架构、权重、训练数据和 RLCD 细节没有公开到可以独立复现的程度。TypeSafe 公开的只是“新架构、并行 sampler、RLCD”这一高层描述。[15]

## 参考资料

[1] Browser Use. “jev-ultrafast README.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/README.md

[2] Browser Use. “jev_ultrafast/model.py.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/model.py

[3] Browser Use. “jev_ultrafast/agent.py.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/agent.py

[4] Browser Use. “jev_ultrafast/snapshot.js.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/snapshot.js

[5] Browser Use. “jev_ultrafast/browser.py.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/browser.py

[6] Browser Use. “jev_ultrafast/questions.py.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/questions.py

[7] Browser Use. “Design notes.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/docs/design.md

[8] Browser Use. “Performance report.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/docs/performance.md

[9] Browser Use. “Offline tests.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/tests/test_agent.py

[10] Browser Use. “Flights verifier.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/examples/flights.py

[11] Browser Use. “Project dependencies.” https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/pyproject.toml

[12] TypeSafe AI. “Speculative fan-out.” https://docs.typesafe.ai/patterns/fan-out

[13] TypeSafe AI. “API reference.” https://docs.typesafe.ai/api

[14] TypeSafe AI. “Models.” https://docs.typesafe.ai/models

[15] TypeSafe AI. “Introducing System One Models & Jev.” https://typesafe.ai/blog/introducing-system-one-models-and-jev

[16] Browser Use issue #23. https://github.com/browser-use/jev-ultrafast/issues/23

[17] Browser Use issue #51. https://github.com/browser-use/jev-ultrafast/issues/51

[18] Browser Use issue #85. https://github.com/browser-use/jev-ultrafast/issues/85
