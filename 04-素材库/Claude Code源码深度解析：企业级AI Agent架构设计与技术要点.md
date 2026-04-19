### **📋 整体概述（背景）**

**核心定位**  
Claude Code不仅是Coding产品，更是**通用终端Agent**，具备循环思考、工具调度、权限治理、上下文恢复和稳定长会话能力。  
**源码价值**：57MB代码量呈现企业级通用Agent架构，包含**Harness架构、Agent Loop、状态管理、记忆系统、工具系统**等核心模块，被行业视为**标杆Agent**设计。

**研读方法**  
1. 先通过AI梳理目录架构与模块职责，建立工程认知  
2. 重点关注各模块设计哲学而非具体实现细节  

### **🏗️ 项目架构与目录解析**

**核心目录树结构**  
![项目目录树图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2F69aaeadbb50f01ba1f516d159f5a7b08?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=ltVv4iiHHAwcKmv%2FZmBd6IHQM5I%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  

| 层级 | 核心目录 | 主要职责 |
|------|----------|----------|
| **入口层** | `main.tsx`、`screens/`、`cli/` | 启动、分流、会话界面 |
| **运行时** | `query.ts`、`query/`、`services/tools/` | Agent Loop与工具编排 |
| **能力层** | `Tool.ts`、`tools.ts`、`tools/` | 内建工具与能力定义 |
| **扩展层** | `services/mcp/`、`skills/`、`plugins/` | MCP（多能力平台）、技能与插件装配 |
| **状态层** | `state/`、`bootstrap/`、`tasks/` | AppState、会话、任务状态管理 |

**阅读优先级**  
1. 先读`main.tsx`、`REPL.tsx`、`cli/print.ts`：理解入口如何送达Harness  
2. 再读`query.ts`、`services/tools/`：分析Agent Loop和工具结果回流  
3. 然后补`Tool.ts`、`tools.ts`、`services/mcp/`：研究能力如何装配  
4. 最后看`state/`、`tasks/`、`sessionStorage`：掌握长会话管理与恢复  

### **🔄 Harness架构设计**

**核心定义**：一套「入口适配 + 会话成型 + 运行桥接」的编排机制，将多入口、多模式、多运行位置收敛为统一的**agent turn执行模型**。  
![Harness架构图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2Fe3f69ddfb3661c870cf7f500da4b6de6?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=QqBkTgzyJ%2FGTQ4tYtxarH5DZfyw%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  

#### **(一) 三层架构拆解**
1. **入口与分流层**  
   - 接收多类型用户入口：CLI/TUI、print/SDK、assistant模式、ssh远端链接  
   - 通过`main.tsx`进行参数解析、模式判断和路由分发  

2. **Harness会话编排层**（核心）  
   - 标准化处理三种会话形态：交互会话（REPL.tsx + commands/hooks）、无界面会话（print.ts + QueryEngine.ts）、远端接入（assistant/ssh/remote attach）  
   - 输出统一**turn契约**：包含messages/prompt/contexts、tools/permissions/ToolUseContext  

3. **Runtime与支撑层**  
   - **本地路径**：进入`query.ts`执行完整Agent Loop，调用模型或工具时通过`services/api`和`services/tools`执行  
   - **远端路径**：转入`remote/bridge/server`，由RemoteSessionManager管理远程执行  

### **🔁 Agent Loop设计**

**核心机制**：TAOR循环（Think-Act-Observe-Repeat），哲学是「将智能下沉给模型，释放智能自主权」。  
![Agent Loop图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2Fe7384209b3c3cbf97a23a93c477ef248?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=9TF%2B2hm8xdzLZzsX36tLsDQRdxg%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  

#### **(一) 循环步骤**
1. **预处理上下文**：压缩、折叠、预算限制与内容替换  
2. **模型流式采样**：调用`callModel()`生成assistant/thinking/tool_use指令  
3. **暂存本轮输出**：记录assistantMessages、toolUse、toolResults  
4. **工具执行**：通过`StreamingToolExecutor`或`runTools`支持串行/并行执行  
5. **结果回流与判断**：  
   - 工具结果补入上下文，组包`next.messages`（旧消息+assistant+toolResults）  
   - 通过`needsFollowUp?`判断是否进入下一轮循环  

#### **(二) 关键特性**
- 非简单问答回合，而是可持续推进任务的执行循环  
- 支持异常补偿：为已发出的`tool_use`补全`tool_result`  

### **📊 状态管理**

**架构设计**：采用「**会话运行态 + 全局会话态 + 持久化层**」分层协同管理。  
![状态管理图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2F37acc6cf0750e5fa4a505a63f8d481d8?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=DlhrjWmgBoqHVEOezshgFT97Ryk%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  

| 状态类型 | 核心模块 | 主要功能 |
|----------|----------|----------|
| **AppState 会话态** | `state/AppState.tsx`、`AppStateStore.ts` | 管理当前会话实时状态（任务、MCP、插件、权限、通知等），服务于交互体验 |
| **bootstrap/state 全局态** | `bootstrap/state` | 管理全局运行信息（项目位置、会话标识、成本预算、模型开关、通道遥测等） |
| **sessionStorage 持久化层** | `sessionStorage` | 写入会话记录（transcript_JSONL、subagent transcript），支持resume和历史读取 |

**协同机制**：通过`ToolUseContext`串联三层状态，暴露会话状态给`query/tools/tasks`，并将turn内上下文带入Agent Loop。

### **🧠 记忆管理**

**架构设计**：策略层、指令层、记忆层三层机制，构成「策略约束 + 指令注入 + 分层记忆召回」的组合式上下文系统。  
![记忆系统图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2F76b84ce890e37323ecff46944b770b85?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=hGQOUceKPhFegLQvNzz92UbeLcY%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  

#### **(一) 三层机制**
1. **策略层**：企业级开关与限制（`utils/settings/settings.ts`托管设置、`services/policyLimits/index.ts`策略限制）  
2. **指令层**：规则文件（CLAUDE.md通用指令、用户级规则、项目级规则）  
3. **记忆层**：多维度记忆存储  
   - 会话记忆（`sessionMemory.ts`）、Auto Memory（项目范围持久记忆）、Team Memory（团队共享记忆）  
   - Agent专属记忆（`agentMemory.ts`）、动态相关记忆（`findRelevantMemories.ts`）、嵌套记忆（`nested_memory`）  

#### **(二) 记忆工作流**

![记忆加载链路图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2F5890e836a5b659424250539c7f8a6122?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=%2BYe9EglPr%2BI51aJojBzCN3cEu7g%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  
1. **记忆来源**：durable memories（磁盘文件）、session memory（当前会话记录）、nested memory（路径触发记忆）  
2. **筛选与装配**：通过`findRelevantMemories`模型驱动筛选相关记忆，装配为attachment注入turn  
3. **回写机制**：通过`postSamplingHook`后台更新会话记忆文件  

**核心差异**：与OpenClaw的RAG语义检索不同，Claude Code采用**LLM驱动的文件级记忆选择**（基于文件名/描述/query语义匹配，非embedding similarity）。

### **🛠️ 工具系统**

**架构设计**：能力定义、能力装配、能力执行三层供给链。  
![工具系统图片](https://get-notes.umiwi.com/morphling%2Fvoicenotes%2Fprod%2F89f9787f290754ddd2c35ea7b191f315?Expires=1779070420&OSSAccessKeyId=LTAI5t7toTp72R3TvdXf9QdK&Signature=790Pgs3w3Vl7GZ2h4J0CMMBs8%2B0%3D&x-oss-process=image%2Fresize%2Cm_lfit%2Cw_720%2Ch_3240)  

#### **(一) 三层架构**
1. **能力来源层**  
   - 内建工具（`tools.ts`、`tools/`：Bash/Read/Edit/AgentTool等）  
   - MCP能力（`services/mcp/client.ts`：远端工具、资源、prompt、auth）  
   - skills/plugins（`skills/`、`plugins/`：扩展prompt、指令、能力发现）  
   - 权限规则（`toolPermissionContext`：allow/ask/deny/bypass/auto）  

2. **装配层**  
   - **能力契约**：`Tool.ts`定义工具接口、`ToolUseContext`管理权限与上下文  
   - **能力装配**：通过`getTools`/`tool pool`合并内建工具与MCP能力为工具池  

3. **执行层**  
   - 回合决策（`query.ts`判断直接回答或触发tool_use）  
   - 工具执行（`runTools`/`StreamingToolExecutor`支持串行/并行执行）  
   - 结果回流（tool_result补入上下文作为下一轮输入）  

### **🚀 隐藏功能与演进方向**

通过未完成代码可见Anthropic的多方向探索，将Coding Agent外溢至更多场景：  

| 功能名 | 功能描述 | 战略意义 |
|--------|----------|----------|
| **Buddy** | AI宠物系统，生成可见、可互动、带反馈和成长的Companion | 探索情感陪伴与产品人格化 |
| **Kairos** | 主动助手模式，从被动问答转向主动介入任务 | 核心能力跃迁：具备"主动性" |
| **Auto-Dream** | 后台长时记忆整合，将历史会话沉淀为durable memory | 突破上下文窗口限制，实现"长时记忆" |
| **Daemon** | 后台会话管理与长驻运行，不依赖前台窗口 | 从"前台交互程序"向"持续运行系统"演进 |
| **Teleport** | 跨环境迁移会话，支持恢复与远端连接 | 将会话升级为"可管理的工作资产" |
| **Ultraplan** | 远端策略探索+本地执行，实现规划外包 | 区分"本地执行"与"远端思考"工作层 |

**演进方向**：打造兼具主动协作、长时记忆、远端运行与会话资产管理能力的**Agent工作平台**。

### **📝 关键洞察**
1. **架构核心优势**：Harness范式实现「下限可控、上限可拓」，通过统一turn契约解决多入口适配问题  
2. **细节竞争力**：恢复能力、权限模型、上下文压缩、长会话稳定性等细节打磨形成技术壁垒  
3. **差异化路径**：记忆系统采用文件级筛选而非向量检索，工具系统通过能力契约实现扩展与可控的平衡