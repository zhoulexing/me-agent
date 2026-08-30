# 李飞飞（Fei-Fei Li）全景研究：从视觉智能、ImageNet 到空间智能与以人为本的 AI

研究日期：2026-08-30  
研究模式：Standard  
资料范围：公开可核验的人物背景、教育经历、职业路径、代表性研究、机构建设、创业、公共政策与争议  
结论置信度：高（核心事实以本人/院校/论文/机构一手资料为主；部分家庭细节和企业争议以访谈、媒体资料补充）

## Executive Summary

- **她最重要的历史贡献不是发明某个神经网络，而是把“数据”变成现代视觉 AI 的基础设施。** 李飞飞领导的 ImageNet 以 WordNet 语义体系组织数百万张经人工标注的图像，并通过 ILSVRC 建立可重复比较的年度竞赛。[10][11] 2012 年 AlexNet 在 ImageNet 上取得突破，是大规模数据、深度卷积网络和 GPU 计算共同作用的结果；AlexNet 的作者不是李飞飞。[12]
- **她的研究主线长达二十多年，而且相当一致：机器怎样像人一样看懂世界。** 她从人类视觉注意与场景知觉、少样本学习出发，推进到大规模识别、图像语言描述、Visual Genome 场景关系、医疗环境智能，再走向机器人学习和三维“空间智能”。[8][13][14][15][16][17]
- **她既是科学家，也是科研基础设施和机构的建设者。** 她参与创办 AI4ALL，推动弱势群体进入 AI；作为斯坦福 HAI 创始领导者，把技术研究与医学、教育、政策和社会科学结合；在参议院证词中主张公共 AI 研究资源、隐私与公平保护、透明采购。[18][19][20]
- **她的人生背景是理解其价值取向的重要线索。** 她出生于北京、成长于成都，高中阶段随父母移民美国；家庭在新泽西经营干洗店，她在普林斯顿求学期间长期周末返家帮忙。她先学物理，再在加州理工把计算机视觉与神经科学结合。[3][5][6][7][8][9]
- **ImageNet 的遗产具有两面性。** 它加速了计算机视觉，也暴露出从网络抓取图像、人物标签、隐私、代表性和冒犯性分类等数据治理问题。ImageNet 团队后来删除了 1,593 个不安全人物类别关联的 600,040 张图像并限制访问；批评者则提醒，数据集的分类体系从来不是价值中立的。[21][22][23]
- **截至 2026 年 8 月，她的工作重心已进入下一阶段。** 她是斯坦福校长的全校 AI 高级顾问、HAI 顾问委员会联合主席，同时任 World Labs 联合创始人兼 CEO，探索能生成、理解并交互于三维世界的 world models；公司 2026 年宣布完成 10 亿美元新融资。[1][2][24][25][26]

**Primary Recommendation：** 若要快速理解李飞飞，先读本报告的“ImageNet 到底贡献了什么”和“研究主线”，再按文末的五步阅读顺序进入原论文、回忆录和批评材料。

**Confidence Level：** 高。32 个来源中，核心履历来自斯坦福、普林斯顿、加州理工和本人资料，研究结论来自原论文，当前职务来自 2026 年斯坦福公告；对年龄差异和 Maven 争议保留限定。

---

## Introduction

### Research Question

本报告回答：李飞飞是谁，她的出身与教育如何塑造研究方向；她真正完成了哪些学术与制度贡献；ImageNet 为什么重要、又有哪些问题；她从计算机视觉转向“空间智能”的逻辑是什么；应如何评价她在 AI 史中的位置。

### Scope & Methodology

“所有资料”在字面上无法穷尽：斯坦福资料称她已有 400 多篇科学论文，而且公开演讲、访谈和课程数量庞大。[1] 本报告因此采用“全景而非穷举”标准：覆盖完整人生与职业骨架，详细解释最有代表性的原创工作，列出关键机构、奖项、争议和进一步阅读入口；不收集未经本人公开的家庭隐私，也不把百科式传闻当成确定事实。

资料优先级为：原论文与论文库；本人简历、院校档案、国会证词；项目与公司官方材料；本人访谈和回忆录；最后才是媒体和批判性分析。每个关键判断尽量由至少三类资料交叉支持。有关李飞飞的自我叙述、机构对她的表述和本报告的综合判断均分开处理。

### Key Assumptions

- 中文名统一写作“李飞飞”，英文写作 “Fei-Fei Li”；她是女性。
- 不以“AI 教母”等媒体称号替代贡献分析，因为现代 AI 是大规模团队协作结果。
- “ImageNet 促成深度学习突破”不等于“李飞飞发明深度学习”或“李飞飞发明 AlexNet”。
- 当前职务按 2026-08-30 可核验信息处理；旧版 Stanford 页面中的历史职务不视为当前日常管理角色。
- 出生日期没有纳入核心资料卡；移民年龄在不同可靠叙述中有 15 岁与“前 16 年在成都”的口径差异，报告统一写“高中时期、约 15—16 岁”。[3][32]

---

## Main Analysis

### Finding 1：人物资料卡与人生时间线

| 项目 | 核验结果 |
| --- | --- |
| 姓名 | 李飞飞 / Fei-Fei Li |
| 出生与成长 | 出生于北京，童年和少年时期主要在成都度过；高中时期随父母移民美国。[3][6] |
| 移民经历 | 家庭定居新泽西州，经济条件紧张；她学习英语、在餐馆工作，并长期帮助家庭经营干洗店。[5][6][7] |
| 本科 | 普林斯顿大学物理学学士，1999 年毕业，High Honors；同时完成应用与计算数学、工程物理证书。[1][4] |
| 研究间隔 | 1999—2000 年曾赴西藏从事藏医药相关研究，这是她本人旧版简介披露的经历。[3] |
| 研究生 | 加州理工学院电气工程硕士、博士，2005 年获博士学位；导师 Pietro Perona、Christof Koch。[4][8] |
| 博士论文 | *Visual Recognition: Computational Models and Human Psychophysics*，把机器视觉、概率模型与人类视觉心理物理学放在同一研究框架中。[8] |
| 教职 | 伊利诺伊大学厄巴纳-香槟分校助理教授；普林斯顿大学助理教授；2009 年加入斯坦福，后任 Sequoia Professor of Computer Science。[1][4] |
| 斯坦福领导经历 | 2013—2018 年任 Stanford AI Lab（SAIL）主任；2019 年参与创建 HAI 并长期担任创始联席负责人。[1][18] |
| Google 经历 | 2017—2018 年任 Google 副总裁、Google Cloud AI/ML 首席科学家，参与推动 Cloud AutoML。[1][29] |
| 当前身份 | World Labs 联合创始人兼 CEO；斯坦福校长的全校 AI 高级顾问；与 John Hennessy 联合主持 HAI 顾问委员会。[1][2][24] |
| 主要研究领域 | 计算机视觉、机器学习、机器人学习、认知与计算神经科学、医疗环境智能、空间智能。[1][9] |

李飞飞人生早期最突出的特点，是两个看似相距很远的世界同时存在：一边是对物理学和“智能是什么”的抽象好奇，另一边是移民家庭生存的具体压力。斯坦福和普林斯顿资料都提到，她在大学期间频繁返回新泽西帮助经营干洗店；Soros Fellowship 的访谈进一步说明，这家店在她大学一年级开业，她连续约七年在周末参与经营，并因为英语能力承担主要对外沟通。[5][6][7]

这些经历不能被简单地包装成“苦难必然造就成功”。更可靠的结论是：它使她对机会分配、移民、教育资源和普通劳动者处境具有长期关注；这与她后来创办 AI4ALL、强调“以人为本的 AI”、关注医疗与公共资源形成可理解但不能机械证明的连续性。[6][19][20]

### Finding 2：教育塑造了她独特的研究方法——从物理规律到人类视觉

李飞飞本科主修物理，而不是计算机科学。斯坦福简历显示，她还完成了应用与计算数学、工程物理证书。[4] 这类训练强调从复杂现象中寻找可计算的结构。进入加州理工后，她没有只沿着传统模式识别前进，而是在计算机视觉研究者 Pietro Perona 与神经科学家 Christof Koch 的共同指导下，把“机器如何识别”与“人类如何看见”连接起来。[8][9]

她 2002 年参与的自然场景研究探讨人在注意力接近缺失的情况下，仍能多快对场景进行分类；这不是今天意义上的大模型论文，但揭示了她早期就把心理物理实验视为机器视觉问题的知识来源。[14] 2005 年博士论文进一步覆盖注意机制、自然场景统计、一次/少次样本物体识别和无监督场景类别学习。[8]

2006 年的 one-shot learning 工作则提出一种贝叶斯迁移方法：不是从一个样本凭空学会新类别，而是从先前类别中学习可复用的先验，使新类别在只有一个或少数样本时仍可被识别，并在 101 个物体类别上实验。[13] 这与 ImageNet 的“大数据”看似相反，实则指向同一问题：人类既能从极少例子迅速概括，也能依赖丰富经验形成世界知识；视觉智能不能只靠一种数据规模解决。

因此，她的研究并非 2009 年突然从 ImageNet 开始。更准确的轨迹是：**研究人类视觉的结构 → 建模小样本概括 → 发现当时机器视觉缺少足够丰富的训练世界 → 建设 ImageNet → 从对象识别扩展到语言、关系、活动、医疗和三维世界。**

### Finding 3：ImageNet 的真正贡献，是把数据集和评测基准提升为科研基础设施

2000 年代中期，视觉算法常在规模较小、类别有限的数据集上比较，结果容易对特定数据集过拟合。李飞飞团队的关键判断是：如果机器要认识真实世界，仅改进算法不够，还需要接近人类概念丰富度的训练数据。他们借用 WordNet 的层级语义体系，以 synset 组织视觉类别，再通过 Amazon Mechanical Turk 进行大规模人工筛选和标注。[10]

2009 年 ImageNet 论文发表时，已覆盖 12 个 WordNet 子树、5,247 个 synset、约 320 万张图像；长期目标则是覆盖 WordNet 约 8 万个 synset，并让每个概念拥有 500—1,000 张清洁图像。[10] 这里真正困难的并不只是下载图片，而是设计类别体系、质量控制、众包流程、可复现训练集和公开评测。

从 2010 年开始的 ImageNet Large Scale Visual Recognition Challenge（ILSVRC）把数据基础设施变成共同的实验仪器。2015 年回顾论文记录了数百万图像、数百个类别和超过 50 家机构参与的年度挑战。[11] 它让不同研究团队在同一任务、同一测试集和同一指标上竞争，错误率得以逐年比较，也把视觉研究从“各自挑数据证明算法”推向公开基准驱动。

#### ImageNet、AlexNet 与深度学习的准确关系

2012 年 Krizhevsky、Sutskever、Hinton 的 AlexNet 使用约 130 万张 ImageNet 图像、1,000 个类别训练深度卷积网络，并借助 GPU 计算显著降低错误率。[12] 三个要素缺一不可：

1. **ImageNet 提供数据和公开赛道**：没有足够大的标注数据，深网络难以显示其规模优势。[10][11]
2. **AlexNet 团队提供算法与工程实现**：卷积网络架构、ReLU、正则化、训练方法和 GPU 实现属于该团队的工作。[12]
3. **计算能力达到临界点**：GPU 使在百万级图像上训练大型网络变得现实。[12][28]

所以，把李飞飞说成“深度学习之母”并不严谨；把她仅说成“整理了一个数据集”又严重低估了贡献。她最重要的判断，是在算法中心主义盛行时，提前把数据、语义组织、众包和基准机制当成科学基础设施。这种基础设施使一个研究共同体能够看到真正的算法跃迁。[10][11][27][28]

### Finding 4：ImageNet 之后，她把“看见”推进到语言、关系、行为与医疗场景

物体分类只能回答“图里有什么”，不能回答“谁和谁发生了什么”“为什么重要”。2015 年 Karpathy 与李飞飞的工作把图像区域与句子片段映射到共同空间，以卷积网络提取视觉区域、以双向循环网络建模语言，推进图像检索与自动描述。[15] 这条路线后来成为视觉—语言模型的重要前史之一。

Visual Genome 则进一步把场景拆成对象、属性、关系、区域描述和问答，包含 108,077 张图像的密集标注。[16] 与 ImageNet 的单标签分类相比，它试图表示“人骑着马”“杯子在桌上”这类关系，使视觉理解从名词表转向结构化世界模型。它也表明李飞飞的兴趣从“识别类别”逐步转向“理解场景”。

在医疗方向，2020 年 Nature 综述提出 ambient intelligence：用环境中的非接触传感器和机器学习理解医院、家庭和养老空间中的活动，以改善临床工作流、患者安全和独立生活。[17] 论文没有把技术当成自动解决方案，而是明确提出隐私、临床验证、透明性、偏差和部署责任问题。[17]

这条研究链可以概括为五层：

| 阶段 | 核心问题 | 代表资料 |
| --- | --- | --- |
| 人类视觉 | 人在注意受限时如何快速理解场景？ | 2002 场景知觉论文 [14] |
| 学习机制 | 机器怎样从一个或少数样本概括？ | 2006 one-shot learning [13] |
| 大规模识别 | 如何让机器认识现实世界中成千上万的概念？ | ImageNet / ILSVRC [10][11] |
| 视觉与语言 | 如何理解对象、属性、关系并用语言描述？ | Captioning / Visual Genome [15][16] |
| 行动与空间 | 系统怎样理解三维世界、预测变化并与之交互？ | Stanford 当前研究 / World Labs [1][24][26] |

### Finding 5：她的另一项长期成果，是建设“以人为本的 AI”机构

2015 年，李飞飞、Olga Russakovsky 和 Rick Sommer 在 Stanford 创建 SAILORS，面向代表性不足的高中生提供 AI 教育；项目后来成为 Stanford AI4ALL，并扩展为全国性组织。[19] 这项工作的价值不只是“培养更多程序员”，而是改变谁能参与定义 AI 问题、数据和用途。

2019 年 Stanford 启动 HAI，由李飞飞与 John Etchemendy 共同领导，联合七个学院约 200 名教师，明确把研究、教育、政策和产业实践放在同一机构中，目标是用 AI 改善人的处境。[18] “以人为本”在她的语境中至少有三层：技术应增强而不是简单取代人；AI 研究需要医学、社会科学、法律和伦理共同参与；公共部门与学术界必须拥有研究资源，不能把前沿能力完全交给少数企业。

2023 年美国参议院证词中，她主张向公众解释 AI 的实际能力与边界，建立隐私和公平保护，提高政府采购与部署透明度，并投资公共 AI 研究基础设施。[20] 她还曾参与白宫 National AI Research Resource Task Force，并担任联合国秘书长科学顾问委员会成员，这些角色显示她已从实验室研究者转变为公共 AI 制度的参与者。[1]

2026 年 Stanford 重组 HAI 与 Data Science，James Landay 接任 HAI 日常领导；李飞飞转为校长 Jonathan Levin 的全校 AI 高级顾问，并与 John Hennessy 共同主持 HAI 顾问委员会。[2] 这不是“离开斯坦福”，而是从研究院管理转向全校战略与顾问角色。

### Finding 6：Google 与创业阶段——从“普及 AI”到“空间智能”

2017—2018 年，李飞飞在 Google Cloud 任副总裁和 AI/ML 首席科学家。2018 年 Cloud AutoML 的公开目标，是让缺少顶尖机器学习专家的企业也能训练定制模型；这与她一贯的“普及 AI 能力”叙事一致。[1][29]

她随后把研究和创业重心转向 spatial intelligence。World Labs 由李飞飞、Justin Johnson、Christoph Lassner 和 Ben Mildenhall 联合创办，目标不是让模型只处理文字或二维像素，而是理解、生成、推理并交互于三维世界。[24] 其产品 Marble 可从文字、图像、视频或粗略 3D 输入生成可编辑三维世界，并导出 Gaussian splats、网格或视频等表示。[26]

2026 年 2 月，World Labs 宣布完成 10 亿美元新融资，投资者包括 AMD、Autodesk、NVIDIA、Emerson Collective、Fidelity 和 Sea 等。[25] 融资额只说明市场预期，不证明技术路线已经成功；Marble 也仍是早期产品。但从研究史看，这不是突然追逐热门概念，而是她从场景识别、视觉—语言、关系图谱、活动理解和机器人学习自然延伸出的下一问题：智能体若要在物理世界工作，就必须建立可生成、可预测、可行动的空间模型。[1][16][17][24][26]

### Finding 7：奖项与历史位置——贡献属于“数据与基准范式”，而非个人英雄神话

李飞飞已当选美国国家工程院、美国国家医学院和美国艺术与科学院院士；Stanford 资料还列出 ACM Fellow 等学术荣誉。[1] 2024 年 VinFuture Grand Prize 把她与 Yoshua Bengio、Geoffrey Hinton、Jensen Huang、Yann LeCun 共同表彰；2025 年 Queen Elizabeth Prize for Engineering 又将她与 Bengio、Bill Dally、Hinton、Huang、John Hopfield、LeCun 并列，特别肯定高质量数据集与基准对现代机器学习的贡献。[27][28]

这种集体授奖其实给出了较准确的历史定位：现代 AI 的跃迁不是某个“教父”或“教母”独立完成，而是神经网络理论、学习算法、芯片、软件系统、数据与评测共同汇合。李飞飞代表其中长期被低估的一层——**数据基础设施、视觉任务定义和公开基准**。

### Finding 8：争议与批评——ImageNet 的成功也暴露了数据治理的结构性问题

ImageNet 使用网络图像、WordNet 分类和众包标注扩展规模，这些方法在当时是创新，也把互联网已有的偏见、未经同意的个人图像和带有社会判断的词汇带入数据集。Crawford 与 Paglen 的 *Excavating AI* 指出，对人物进行分类本身就携带政治与历史假设，不能把标签看成自然存在的中性事实。[23]

ImageNet 团队 2019 年的官方更新承认人物子树存在公平与代表性问题：完整子树包含 2,832 个类别，团队识别 1,593 个不安全 synset，删除其关联的 600,040 张图像，并对人物类别访问进行限制。[21] 随后的论文提出删除不可视觉判断或冒犯性类别、平衡人口属性等治理方法。[22] 值得注意的是，ILSVRC 的常用 1,000 类挑战子集只有三个直接人物类别，因此不能把完整 ImageNet 人物子树的问题不加区分地等同于 2012 竞赛训练集。[21]

合理评价应同时承认三点：第一，ImageNet 是里程碑；第二，原始数据工程在同意、人物分类和社会偏见方面存在真实缺陷；第三，后续修复是必要进步，但不能抹去教训。它推动整个领域认识到，数据集不是被动原料，而是带有设计者决策、劳动关系、版权与社会权力的产品。[21][22][23]

Google Project Maven 是另一项较弱证据的争议。公开报道曾围绕李飞飞在 Google Cloud 管理期间对军方 AI 项目的内部沟通提出批评；Google 后来公开表示不再续签 Maven 后续合同，并将新的 AI 原则用于政府和云业务。[30] 现有一手公司材料不足以证明她个人设计或建造了武器系统，因此本报告只把它列为企业领导阶段的伦理与沟通争议，不作超出证据的个人技术责任判断。

---

## Synthesis & Insights

### Pattern 1：她的核心问题始终不是“识别图片”，而是“视觉如何产生智能”

从心理物理学、少样本学习到 ImageNet、视觉语言、医疗环境和三维世界，研究对象不断扩大，但问题没有根本变化：智能怎样从感知中建立概念、关系、预测和行动。[8][13][14][15][16][17][24] 因此，把她概括成“ImageNet 负责人”是对的，却不完整；ImageNet 是一条更长研究主线的关键中点。

### Pattern 2：她擅长把研究瓶颈重新定义成公共基础设施

ImageNet 不只是论文，而是数据库、众包工程、语义结构和竞赛；AI4ALL 不只是一次课程，而是人才入口；HAI 不只是一个实验室，而是跨学科和政策组织；World Labs 也试图把三维生成模型做成创作者与机器人可用的平台。[10][11][18][19][24] 她的影响力很大一部分来自“建设让其他人可以继续工作的系统”。

### Pattern 3：技术乐观与治理意识并存，但二者之间持续存在张力

李飞飞相信 AI 能改善医疗、教育和生产力，同时反复强调人的尊严、公平、隐私与公共研究资源。[17][18][20][32] 然而 ImageNet 的人物子树证明，宏大的“让机器看见世界”目标也可能在扩展规模时忽略具体个体的同意和标签伤害。[21][23] 她的职业轨迹因此也是 AI 领域从“先扩大能力”走向“能力与治理共同设计”的缩影。

### Novel Insight：从二维互联网数据到三维世界模型，是对 ImageNet 局限的技术回应

ImageNet 把世界压成单张图片和类别标签；Visual Genome 加入对象关系和语言；环境智能加入时间、活动和空间；World Labs 再尝试生成可交互三维世界。[10][16][17][24][26] 没有单一来源直接把这些工作写成一条路线，但跨二十年看，它们显示她持续补足前一种表示的缺失：**类别 → 关系 → 活动 → 空间与行动**。这也是理解“空间智能”而不把它当营销词的最好方式。

### For the reader

研究李飞飞时，最值得带走的不是“她很励志”或“她创造了 ImageNet”两句标签，而是三个方法：算法之外寻找真正瓶颈；把科研资产设计成共同体可复用的基础设施；在规模成功后反过来审视数据、劳动和社会后果。

---

## Claims-Evidence Table

| 核心判断 | 主要证据 | 置信度 |
| --- | --- | --- |
| 高中时期移民、家庭经营干洗店 | 本人简介、Princeton、Stanford HAI、Soros 访谈 [3][5][6][7] | 高；准确年龄有口径差异 |
| 物理—计算机视觉—神经科学的跨学科训练 | Stanford CV、Caltech 论文库与访谈 [4][8][9] | 高 |
| ImageNet 的核心贡献是数据基础设施和基准 | 原论文、ILSVRC 论文、AlexNet 原论文 [10][11][12] | 很高 |
| 李飞飞没有发明 AlexNet | AlexNet 作者与论文记录 [12] | 很高 |
| 研究从感知扩展到关系、行动和空间智能 | 多篇原论文、Stanford、World Labs [1][13][15][16][17][24] | 高 |
| 以人为本 AI 通过 AI4ALL、HAI 和政策工作制度化 | Stanford 与国会一手材料 [18][19][20] | 高 |
| 当前为 Stanford 全校 AI 高级顾问、World Labs CEO | 2026 Stanford 与公司材料 [1][2][24][25] | 很高 |
| ImageNet 人物子树存在治理缺陷并已部分修复 | 项目公告、论文、独立批评 [21][22][23] | 高 |
| Project Maven 中的个人责任 | Google 公司声明、媒体访谈 [30][32] | 中低；不作技术责任推断 |

## Limitations & Caveats

第一，本报告没有逐条列出 400 多篇论文，而是按研究主线选择高影响代表作；完整论文表应以 Stanford Profile、Google Scholar 和 CV 动态页面为准。[1][4]

第二，早年人物叙述存在小口径差异：本人旧简介称前 16 年在成都，媒体报道常写 15 岁移民。[3][32] 因此使用“高中时期、约 15—16 岁”，不伪造精确年龄。出生日期也未以缺乏一手确认的百科资料作为核心事实。

第三，公司融资、产品介绍和愿景来自 World Labs 自身，只能确认它如何描述技术与资本事件，不能证明商业成功或模型优于竞争者。[24][25][26]

第四，Maven 争议的一手内部邮件和完整决策链未公开；Google 的公司声明可以确认政策结果，但不能独立还原李飞飞个人的决策权限。[30] 该项不影响对其科研贡献的判断，却提示企业领导者也需对部署边界和沟通承担治理责任。

## Counterevidence Register

**对“李飞飞发明了现代深度学习”的反证：** AlexNet 原论文明确列出 Krizhevsky、Sutskever、Hinton 为作者；深度学习突破还依赖 GPU 与更早的神经网络研究。[12][28] 修正后的结论是，她建设了让算法突破可训练、可比较、可见的数据与基准环境。

**对“ImageNet 只是纯粹正面遗产”的反证：** 人物子树包含冒犯、不可视觉判断和代表性不平衡类别，独立批评与项目团队自身修复均予以确认。[21][22][23] 这使结论从“成功数据集”变为“改变领域、同时迫使领域建立数据治理意识的基础设施”。

**对“以人为本只是一句口号”的支持与保留：** AI4ALL、HAI 和参议院证词证明它已形成机构和政策行动；但这些机构的长期效果、企业部署的一致性需要独立评估，不能仅由使命声明证明。[18][19][20][30]

## Recommendations

### 建议的五步阅读顺序

1. **先建立人物全貌：** 读 Stanford Profile 与 2026 年职务更新，避免把历史头衔当成当前职务。[1][2]
2. **再读她自己的叙述：** 《The Worlds I See》（中文常译《我看见的世界》）把移民、家庭、科研与以人为本 AI 串在一起，但要把回忆录视为第一人称视角，而非唯一历史记录。[31]
3. **理解 ImageNet：** 依次读 2009 ImageNet、2015 ILSVRC、2012 AlexNet 三篇论文，分清数据、评测、算法和算力的贡献。[10][11][12]
4. **看研究如何超越分类：** 读 one-shot、图像描述、Visual Genome 和医疗环境智能。[13][15][16][17]
5. **最后读批评与修复：** 将 ImageNet 2019 官方更新、公平数据集论文和 *Excavating AI* 并读，形成不英雄化也不抹杀贡献的评价。[21][22][23]

如果后续要把这项调研转化为文章或课程，建议围绕一个清晰问题展开，而不是写流水账传记：**“李飞飞真正改变 AI 的，是算法、数据，还是研究组织方式？”** 这个问题能自然串起她的科研、ImageNet、HAI、AI4ALL 和 World Labs。

---

## Bibliography

[1] Stanford University (2026). “Fei-Fei Li's Profile.” https://profiles.stanford.edu/fei-fei-li

[2] Stanford University (2026). “Why Stanford is restructuring for AI’s next era.” https://news.stanford.edu/stories/2026/05/james-landay-fei-fei-li-john-hennessy-hai-interview

[3] Fei-Fei Li (archived biography). “Li Fei-Fei: Biography.” https://cs.stanford.edu/people/feifeili/Bio.htm

[4] Stanford University. “Fei-Fei Li Curriculum Vitae.” https://cap.stanford.edu/profiles/viewCV?facultyId=15052&name=Fei-Fei_Li

[5] Princeton University (2024). “AI trailblazer Fei-Fei Li, Class of 1999, inspires incoming Princeton students.” https://www.princeton.edu/news/2024/09/06/ai-trailblazer-fei-fei-li-class-1999-inspires-incoming-princeton-students-pre-read

[6] Stanford HAI (2023). “Fei-Fei Li: A Candid Look at a Young Immigrant’s Rise to AI Trailblazer.” https://hai.stanford.edu/news/fei-fei-li-candid-look-young-immigrants-rise-ai-trailblazer

[7] Paul & Daisy Soros Fellowships (2017). “Fei-Fei Li (1999): Founding mother of artificial intelligence revolution.” https://pdsoros.org/fei-fei-li-1999-founding-mother-of-artificial-intelligence-revolution/

[8] Li, F.-F. (2005). “Visual Recognition: Computational Models and Human Psychophysics.” Caltech Thesis. https://thesis.caltech.edu/2390/

[9] Caltech Alumni (2024). “Fei-Fei Li.” https://www.alumni.caltech.edu/fei-fei-li/

[10] Deng, J., Dong, W., Socher, R., Li, L.-J., Li, K., & Fei-Fei, L. (2009). “ImageNet: A Large-Scale Hierarchical Image Database.” CVPR. https://mlanthology.org/cvpr/2009/deng2009cvpr-imagenet/

[11] Russakovsky, O. et al. (2015). “ImageNet Large Scale Visual Recognition Challenge.” IJCV. https://doi.org/10.1007/s11263-015-0816-y

[12] Krizhevsky, A., Sutskever, I., & Hinton, G. (2012). “ImageNet Classification with Deep Convolutional Neural Networks.” NeurIPS. https://papers.nips.cc/paper_files/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html

[13] Fei-Fei, L., Fergus, R., & Perona, P. (2006). “One-shot learning of object categories.” IEEE TPAMI. https://pubmed.ncbi.nlm.nih.gov/16566508/

[14] Li, F.-F. et al. (2002). “Rapid natural scene categorization in the near absence of attention.” PNAS. https://pmc.ncbi.nlm.nih.gov/articles/PMC123186/

[15] Karpathy, A., & Li, F.-F. (2015). “Deep Visual-Semantic Alignments for Generating Image Descriptions.” CVPR. https://openaccess.thecvf.com/content_cvpr_2015/html/Karpathy_Deep_Visual-Semantic_Alignments_2015_CVPR_paper.html

[16] Krishna, R. et al. (2017). “Visual Genome: Connecting Language and Vision Using Crowdsourced Dense Image Annotations.” IJCV. https://cs.stanford.edu/groups/vision/pdf/visualgenome.pdf

[17] Haque, A. et al. (2020). “Illuminating the dark spaces of healthcare with ambient intelligence.” Nature. https://doi.org/10.1038/s41586-020-2669-y

[18] Stanford University (2019). “Stanford University launches the Institute for Human-Centered Artificial Intelligence.” https://news.stanford.edu/stories/2019/03/stanford_university_launches_human-centered_ai

[19] Stanford AI Lab (2019). “Stanford AI4ALL Program Brochure.” https://ai.stanford.edu/wp-content/uploads/2019/05/SAIL_Brochure_2019_LowRes.pdf

[20] Fei-Fei Li (2023). “U.S. Senate Testimony.” https://hai.stanford.edu/assets/files/2023-09/Fei-Fei-Li-Senate-Testimony.pdf

[21] ImageNet (2019). “Identifying and Remedying Issues of Fairness and Representation in ImageNet.” https://www.image-net.org/update-sep-17-2019.php

[22] Yang, K. et al. (2019). “Towards Fairer Datasets: Filtering and Balancing the Distribution of the People Subtree in the ImageNet Hierarchy.” arXiv:1912.07726. https://arxiv.org/abs/1912.07726

[23] Crawford, K., & Paglen, T. (2019). “Excavating AI: The Politics of Images in Machine Learning Training Sets.” https://excavating.ai/

[24] World Labs (2026). “About Us.” https://www.worldlabs.ai/about

[25] World Labs (2026). “World Labs Announces New Funding.” https://www.worldlabs.ai/blog/funding-2026

[26] World Labs (2025). “Marble: A Multimodal World Model.” https://www.worldlabs.ai/blog/marble-world-model

[27] Queen Elizabeth Prize for Engineering (2025). “His Majesty The King presents 2024 and 2025 Queen Elizabeth Prizes for Engineering.” https://qeprize.org/news/king-presentation-qeprize

[28] VinFuture Prize (2024). “The 2024 VinFuture Prize honors four scientific works.” https://vinfutureprize.org/news-insights/the-2024-vinfuture-prize-honors-four-scientific-works-under-the-theme-of-resilient-rebound/

[29] Google Cloud (2018). “Cloud AutoML: Making AI accessible to every business.” https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/cloud-automl-making-ai-accessible-every-business/

[30] Google Cloud (2018). “Incorporating Google’s AI Principles into Google Cloud.” https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/incorporating-googles-ai-principles-google-cloud/

[31] Li, F.-F. (2023). *The Worlds I See: Curiosity, Exploration, and Discovery at the Dawn of AI.* Macmillan. https://us.macmillan.com/books/9781250897930/theworldsisee/

[32] The Guardian (2023). “AI pioneer Fei-Fei Li: I’m more concerned about the risks that are here and now.” https://www.theguardian.com/technology/2023/nov/05/ai-pioneer-fei-fei-li-im-more-concerned-about-the-risks-that-are-here-and-now

## Methodology Appendix

本次研究建立了独立、可审计的研究目录，共登记 32 个来源、34 条证据摘记和 12 条核心主张。检索分为六组：人物与教育；学术职业；原论文与数据集；机构与公共政策；当前创业；争议与反证。核心结论只在人物本人、院校或原论文可以确认时定为高置信度。

研究中特别处理了四个高风险混淆：其一，把 ImageNet 的数据/基准贡献与 AlexNet 的算法/工程贡献分开；其二，把完整 ImageNet 人物子树与 ILSVRC 1,000 类子集分开；其三，把 HAI 的历史创始职务与 2026 年后的当前职务分开；其四，把 Maven 的企业争议与无法证明的个人技术责任分开。

本报告为只读研究产物，未写入 `03-技术认知/`，也未同步到 Get 笔记。若用户决定把结论沉淀为自己的观点，应在确认后另行整理，而不应把李飞飞本人或外部评论的观点直接记为用户认知。
