# Agent 沙箱技术知识框架

- **建立日期**：2026-08-10
- **类目**：长期技术研究
- **状态**：第一版框架
- **研究原则**：先讲安全边界和底层机制，再研究具体产品与源码

## 一、这份框架要回答什么

Agent 沙箱不是某一种产品，也不是简单地“把 Agent 放进 Docker”。它是一组分布在不同层次的隔离机制。

这份框架主要回答五个问题：

1. Agent 运行时有哪些需要保护的边界？
2. 虚拟机、容器、Pod、容器运行时和进程沙箱分别处在哪一层？
3. 每一层依靠什么底层机制实现隔离？
4. 每一层能够解决什么问题，又解决不了什么问题？
5. 在 Kubernetes 上运行 Agent 时，应该怎样组合这些能力？

当前第一版只建立整体地图，不深入每一个 syscall、内核模块或具体产品的源码实现。

---

## 二、先建立统一的判断维度

研究任何沙箱方案时，先不要看产品宣传，而要检查它隔离了什么。

| 隔离维度 | 核心问题 | 典型机制 |
| --- | --- | --- |
| 内核隔离 | Agent 攻破当前环境后，能否直接攻击宿主机内核？ | Hypervisor、Guest Kernel、用户态内核 |
| 身份与进程隔离 | Agent 能否看到、控制或调试其他进程？ | User/PID Namespace、权限、信号和 ptrace 限制 |
| 文件隔离 | Agent 能读写哪些目录、配置、代码和凭证？ | Mount Namespace、只读挂载、Landlock、SELinux、AppArmor |
| 网络隔离 | Agent 能连接哪些 IP、端口、域名和服务？ | Network Namespace、NetworkPolicy、代理、Egress Gateway |
| 系统调用隔离 | Agent 能调用哪些内核能力？ | Seccomp、Capabilities、用户态内核 |
| 资源隔离 | Agent 能使用多少 CPU、内存、进程、磁盘和网络？ | Cgroups、Kubernetes Resources、Quota、超时 |
| 凭证隔离 | Agent 能否使用凭证但拿不到真实值？ | Credential Broker、短期令牌、请求签名代理 |
| 业务权限 | Agent 能执行哪些工具和业务动作？ | 工具权限、审批、RBAC、额度和审计 |

一个方案即使名字叫“沙箱”，也可能只解决其中一两个维度。

---

## 三、Agent 运行环境的完整分层

从底层到上层，可以把 Agent 的安全体系分成六层：

```text
第六层  Agent 应用权限
        工具权限、MCP 权限、审批、业务 RBAC、审计

第五层  Pod 内 Agent 进程沙箱
        文件、进程、系统调用、网络出口和凭证限制

第四层  Pod 的底层运行方式
        runc / gVisor / Kata Containers

第三层  Kubernetes 与容器管理
        Pod、containerd/CRI-O、CNI、Volume、Cgroups

第二层  VM / MicroVM
        独立 Guest Kernel、硬件虚拟化边界

第一层  物理机与硬件
        CPU、内存、磁盘、网卡
```

在 Kubernetes 中，一条比较准确的执行链是：

```text
Kubernetes API
  → kubelet
  → CRI
  → containerd / CRI-O
  → runc / gVisor / Kata
  → Pod 中的容器
  → Pod 内 SandboxManager
  → 被限制的 Agent 进程
```

需要特别注意：

- Kubernetes 是编排平台，不是单一的沙箱实现。
- Pod 是 Kubernetes 的运行和调度单元，不是一种底层隔离技术。
- runc、gVisor、Kata 决定 Pod 在节点上如何执行。
- Pod 内进程沙箱决定 Agent 能使用 Pod 内的哪些能力。

---

## 四、第一类：虚拟机与 MicroVM

### 4.1 核心原理

虚拟机通过 Hypervisor 虚拟 CPU、内存、磁盘和网络设备，并运行独立的 Guest Kernel。

```text
物理机
└── Hypervisor
    ├── VM A
    │   ├── Guest Kernel
    │   └── Agent A
    └── VM B
        ├── Guest Kernel
        └── Agent B
```

Agent 的系统调用首先进入 Guest Kernel，而不是直接进入宿主机内核。即使 Guest Kernel 被攻破，攻击者通常还需要突破虚拟化边界才能进入宿主机。

### 4.2 传统 VM 与 MicroVM

传统 VM 提供完整虚拟硬件和操作系统能力，兼容性强，但启动和资源开销较高。

MicroVM 则减少不必要的虚拟设备和通用能力，以更小的攻击面和更低开销运行短生命周期工作负载。Firecracker 就属于这一类，它使用 KVM 创建轻量虚拟机。

### 4.3 主要解决的问题

这一层主要解决：

> 不可信 Agent 与物理宿主机之间的内核级隔离。

适合完全不可信、多租户、允许执行任意代码的 Agent 平台。

### 4.4 解决不了的问题

VM 不会自动限制 Agent：

- 能读取虚拟机里的哪些文件；
- 能访问哪些公网域名；
- 能否读取注入到虚拟机里的密钥；
- 能执行哪些业务工具。

这些问题仍然要由 VM 内的文件、网络、凭证和应用权限层解决。

---

## 五、第二类：容器与 Kubernetes Pod

### 5.1 容器的本质

普通 Linux 容器不是轻量虚拟机。多个容器通常共享宿主机 Linux 内核，只是看到不同的资源视图。

```text
宿主机 Linux Kernel
├── Container A
├── Container B
└── Container C
```

容器主要依靠：

- Namespace：隔离进程看到的 PID、网络、挂载、用户等资源；
- Cgroups：限制 CPU、内存、进程数和 I/O；
- Capabilities：把传统 root 权限拆成更小的能力；
- Seccomp：限制进程可以使用的系统调用；
- SELinux/AppArmor：实施额外的强制访问控制；
- Rootfs 和 Volume：构造容器看到的文件系统。

Namespace 的核心含义是：把全局资源包装成一个局部视图，让其中的进程感觉自己拥有独立实例。

### 5.2 Pod 的本质

Pod 是 Kubernetes 最小的可部署计算单元。一个 Pod 可以包含一个或多个共同调度的容器。

同一 Pod 内的容器通常：

- 运行在同一个节点；
- 共享 Pod IP 和 localhost；
- 可以共享 Volume；
- 生命周期相互关联。

因此，同一个 Pod 内的容器不应默认视为彼此强隔离。

### 5.3 Kubernetes 负责什么

Kubernetes 主要负责：

- 调度和生命周期；
- 容器镜像与运行配置；
- CPU、内存和临时存储限制；
- Pod 网络与 NetworkPolicy；
- Volume；
- ServiceAccount 和 RBAC；
- 扩缩容、故障恢复与审计。

真正创建容器的是节点上的容器运行时。kubelet 通过 CRI 与 containerd、CRI-O 等运行时通信。

### 5.4 安全边界

普通容器共享宿主机内核，因此它的核心风险是：

> Agent 一旦利用内核或容器运行时漏洞完成容器逃逸，就可能进入 Kubernetes 节点。

容器提供了很好的部署、资源治理和基础隔离，但对于完全恶意的多租户代码，通常还需要更强运行时或虚拟机边界。

---

## 六、第三类：runc、gVisor 与 Kata

这三者不是 Pod 里面的三个组件，而是 Pod 底层的三种不同执行方式。

### 6.1 runc：普通共享内核容器

runc 是符合 OCI Runtime Specification 的低层容器运行时。

```text
Agent
  → Linux syscall
  → 宿主机 Kernel
```

它依靠宿主机内核的 Namespace、Cgroups、Capabilities、Seccomp 和 LSM 提供隔离。

主要特点：

- 兼容性高；
- 启动快；
- 性能开销低；
- 与宿主机共享内核；
- 对宿主机内核暴露的攻击面相对更大。

### 6.2 gVisor：用户态应用内核

gVisor 提供一个用 Go 实现的应用内核 Sentry，并通过 `runsc` 与 OCI/Kubernetes 体系集成。

```text
Agent
  → syscall 被拦截
  → gVisor Sentry
  → 收敛后的宿主机调用
  → 宿主机 Kernel
```

它不是简单的 seccomp 黑名单，也不是传统虚拟机。其关键价值是让应用的大量 Linux 系统调用先由用户态内核实现，从而减少应用直接接触宿主机内核接口的范围。

主要特点：

- 比普通容器多一层 syscall 和内核接口隔离；
- 仍然保持容器使用方式；
- 启动和资源开销通常低于完整 VM；
- 系统调用、文件和网络 I/O 需要经过额外层；
- 某些依赖特殊内核能力的工作负载兼容性较差。

### 6.3 Kata Containers：VM 化容器

Kata 通过轻量 VM 运行 Pod，并在 VM 中使用 Guest Kernel 创建容器工作负载。

```text
kubelet
  → containerd / CRI-O
  → Kata Runtime
  → Hypervisor
  → Guest Kernel
  → Pod Containers
```

在常见 Kubernetes 模型中，Pod Sandbox 对应一台 VM，Pod 中的容器则是 Guest OS 内的进程和 namespace。

主要特点：

- Pod 不直接共享宿主机内核；
- 提供硬件虚拟化隔离；
- 保留 Kubernetes 和容器接口；
- 启动、内存和运维成本高于 runc；
- 存储、网络和可观测性链路更加复杂。

### 6.4 三者的核心差别

| 运行方式 | Agent syscall 首先进入哪里 | 是否直接共享宿主内核 | 主要定位 |
| --- | --- | --- | --- |
| runc | 宿主机 Linux Kernel | 是 | 普通容器 |
| gVisor | gVisor Sentry | 间接使用 | 用户态内核隔离 |
| Kata | Guest Kernel | 否 | VM 化容器 |

它们主要保护的是：

> Pod 到 Kubernetes 节点之间的边界。

---

## 七、第四类：Pod 内 Agent 进程沙箱

即使已经使用 runc、gVisor 或 Kata，Pod 内仍然可能同时存在：

```text
Pod
├── SandboxManager
├── 网络与凭证代理
├── 工作区
├── 配置和环境变量
└── 不可信 Agent 进程
```

运行时只能保护 Pod 不容易逃到节点，不能自动限制 Agent 在 Pod 内能够做什么。因此还需要第二道进程级沙箱。

### 7.1 进程隔离

目标是让 Agent：

- 看不到外部管理进程；
- 不能向外部进程发送信号；
- 不能 ptrace 外部进程；
- 不能读取外部进程的 `/proc/<pid>` 信息；
- 不能留下脱离管理的后台进程。

常见机制包括 PID Namespace、User Namespace、重新挂载 `/proc`、信号限制和 seccomp。

其中 `/proc` 是 Linux 内核提供的实时进程与系统信息窗口。重新挂载 `/proc` 的目的，是让 Agent 只能看到沙箱内部的 PID，而不是 Pod 内 SandboxManager 等外部进程。

### 7.2 文件隔离

典型目标是：

```text
系统根目录       只读
Agent工作区      可读写
依赖和工具目录   只读
凭证目录         不可读
系统配置         不可写
临时目录         有限可写
```

常见实现机制：

- Mount Namespace；
- bind mount；
- read-only bind；
- tmpfs 遮盖目录；
- `/dev/null` 遮盖文件；
- Landlock、SELinux、AppArmor 等访问控制。

Mount Namespace 改变的是 Agent 看到的文件系统视图；Landlock/LSM 则在访问路径上继续施加权限规则。

### 7.3 系统调用和能力限制

Seccomp 可以限制进程能够进入内核的 syscall，Capabilities 可以移除不需要的 root 能力。

两者作用不同：

- Capabilities 控制进程拥有哪些特权能力；
- Seccomp 控制进程能否调用某些内核接口。

它们通常用于减少攻击面，而不是单独构成完整文件或网络沙箱。

### 7.4 网络隔离

一种常见模式是先移除 Agent 的直接网络能力，再提供受控代理：

```text
Agent Network Namespace
  → 没有可直接访问外网的接口
  → 只能连接本地 HTTP/SOCKS 代理
  → 代理检查域名和请求
  → 外部网络
```

内核层擅长限制 IP、端口和网络接口；代理层则适合处理域名、HTTP 方法、路径、Header 和请求内容。

### 7.5 这一层主要解决什么

Pod 内进程沙箱主要保护：

> Agent 到 Pod 内文件、进程、网络和凭证之间的边界。

它通常不负责 CPU、内存和磁盘配额，这些仍要交给 Kubernetes 和 Cgroups。

Anthropic `sandbox-runtime` 属于这一类：Linux 上主要使用 bubblewrap、namespace、挂载和 seccomp，并通过宿主于沙箱外的 HTTP/SOCKS 代理管理网络。

---

## 八、第五类：网络与凭证代理

网络代理不仅用于“允许哪些域名”，还是 Agent 凭证隔离的重要组成部分。

### 8.1 为什么仅靠 NetworkPolicy 不够

Kubernetes NetworkPolicy 通常工作在 IP、端口和协议层，适合实现 Pod 级外层边界。

Agent 场景还经常需要判断：

- 是否允许 `api.example.com`；
- 是否允许某个 HTTP 路径；
- 是否允许上传操作；
- 是否允许特定 Header；
- 是否应该给请求注入凭证。

这些属于应用层策略，需要 HTTP/SOCKS、TLS 终止或企业 Egress Gateway 配合。

### 8.2 凭证代理的基本模型

```text
真实密钥保存在可信管理进程
        ↓
Agent只拿到占位符或短期身份
        ↓
Agent发起请求
        ↓
代理校验目标主机和请求
        ↓
代理注入真实凭证或重新签名
        ↓
目标服务
```

它实现的是：

> Agent 可以使用某项身份能力，但不能直接获得长期密钥。

### 8.3 需要注意的边界

代理本身处于可信计算基中。它需要解析不可信 Agent 发来的流量，并持有真实凭证。如果代理被攻破，攻击者可能获得更高权限。

因此外层仍然需要：

- Kubernetes NetworkPolicy；
- 企业 Egress Gateway；
- 短期、最小权限凭证；
- 请求审计和额度控制。

---

## 九、第六类：Agent 应用权限层

这一层包括：

- 工具调用权限；
- MCP Server 权限；
- Shell、文件写入和高风险操作审批；
- 业务 RBAC；
- 金额、数量和频率额度；
- 操作审计；
- 人工确认。

它决定的是 Agent 在业务语义上“被允许做什么”。

需要区分三类控制：

```text
Prompt规则
  表达期望，但模型可能不遵守

Agent Runtime权限
  在工具层拒绝操作

OS/VM沙箱
  在操作系统和内核层强制拒绝
```

Prompt 中写“不要读取 SSH Key”不是安全边界。真正的安全边界是即使 Agent 尝试读取，内核、挂载策略或工具权限也会让操作失败。

---

## 十、还有一条独立路线：语言级沙箱

部分 Agent 不需要完整 Linux 环境，可以使用：

- WebAssembly；
- V8 Isolate；
- JavaScript VM；
- 受限解释器；
- 数据库内部执行环境。

它的结构通常是：

```text
不可信代码
  → 受限语言运行时
  → 显式开放的 Host Function
  → 文件、网络或业务能力
```

优点是启动快、默认能力少、接口容易显式授权。缺点是不能直接兼容完整 Shell、Linux 工具链和任意二进制程序。

它适合插件、公式和小段代码执行，不一定适合完整 Coding Agent。

---

## 十一、理解逃逸后的“下一站”

纵深防御的关键不是假设某一层永远不会被突破，而是控制突破后的影响范围。

```text
Agent应用权限被绕过
        ↓
攻击Pod内进程沙箱
        ↓
进入Pod/容器内部
        ↓
攻击runc、gVisor或Guest Kernel
        ↓
进入Kubernetes节点
        ↓
攻击节点VM或Hypervisor
        ↓
进入物理宿主机
```

不同运行时下，从 Pod 到节点的路径不同：

| 运行时 | Agent 逃出 Pod 后仍需突破的主要边界 |
| --- | --- |
| runc | 宿主机内核或容器运行时边界 |
| gVisor | gVisor Sentry/平台边界，再到宿主机内核 |
| Kata | Guest Kernel 和虚拟机边界 |
| 独立 MicroVM | Guest Kernel、VMM/Hypervisor 边界 |

沙箱的价值不是让风险归零，而是增加独立边界，并让每次突破后的权限仍然有限。

---

## 十二、Kubernetes 上的三种组合方案

### 12.1 内部可信 Agent

```text
节点VM
  → Kubernetes
  → runc Pod
  → Pod内文件/网络沙箱
  → Agent
```

适合内部代码、受控 Skill、可信 MCP 和有限用户范围。重点是低成本、兼容性与防误操作。

### 12.2 较高风险 Agent

```text
节点VM
  → Kubernetes
  → gVisor Pod
  → Pod内文件/网络/凭证沙箱
  → Agent
```

适合会运行用户脚本或第三方依赖，但仍希望保持较低启动成本的场景。

### 12.3 完全不可信多租户 Agent

```text
物理机或节点VM
  → Kata / MicroVM
  → 一个Agent会话一个隔离环境
  → Pod内文件/网络/凭证沙箱
  → Agent
```

适合公网用户任意代码执行、多租户 Coding Agent 和高价值数据环境。

### 12.4 不论使用哪种方案，都应有的基础要求

- 一个不可信 Agent 会话一个 Pod 或独立沙箱实例；
- 不使用 `privileged: true`；
- 不挂载 Docker/containerd socket；
- 不使用任意 `hostPath`；
- 默认关闭 ServiceAccount Token，确有需要时使用最小权限身份；
- 设置 CPU、内存、临时磁盘、PID 和超时限制；
- 根文件系统尽可能只读；
- 工作区使用独立 Volume；
- Pod 网络默认拒绝，出口经过 Egress Gateway；
- 真实长期凭证不直接暴露给 Agent；
- 沙箱不可用时失败关闭，而不是自动降级成无沙箱执行。

---

## 十三、总体选型矩阵

| 方案 | 内核隔离 | 启动速度 | 兼容性 | 资源成本 | 主要用途 |
| --- | --- | --- | --- | --- | --- |
| 语言级沙箱 | 不直接提供宿主内核隔离 | 极快 | 低到中 | 低 | 小段代码和插件 |
| Pod内进程沙箱 | 共享Pod/宿主运行时边界 | 快 | 高 | 低 | 文件、网络和凭证限制 |
| runc容器 | 共享宿主机内核 | 快 | 高 | 低 | 普通容器工作负载 |
| gVisor | 用户态内核中介 | 较快 | 中 | 中 | 较高风险容器工作负载 |
| Kata | 独立Guest Kernel | 中 | 较高 | 中高 | 高风险Pod和多租户 |
| Firecracker/MicroVM | 独立Guest Kernel | 中 | 取决于平台封装 | 中高 | 强多租户与Serverless |
| 传统VM | 独立Guest Kernel | 慢 | 高 | 高 | 长生命周期强隔离环境 |

这个表不能直接给出唯一答案。选型还需要结合：

- 输入代码是否完全不可信；
- 是否多租户；
- 是否运行任意 Linux 二进制；
- 启动延迟要求；
- 工作负载持续时间；
- 数据敏感等级；
- 节点和运行时的可控程度；
- 成本与兼容性要求。

---

## 十四、当前阶段的核心结论

1. Agent 沙箱是一套分层体系，不是一个单独产品。
2. VM/MicroVM 主要保护工作负载到宿主机的内核边界。
3. Kubernetes 主要负责编排、生命周期和资源治理。
4. runc、gVisor、Kata 是 Pod 底层的不同运行方式，不是 Pod 内的业务组件。
5. Pod 内进程沙箱负责约束 Agent 对文件、进程、网络和凭证的访问。
6. NetworkPolicy 负责外层 IP/端口边界，代理负责域名、HTTP 请求和凭证策略。
7. Prompt 和工具说明不是强制安全边界，关键操作必须由运行时或操作系统拒绝。
8. 对完全不可信的多租户 Agent，应采用强外层隔离与细粒度内层能力控制的组合。
9. Kubernetes 资源限制和沙箱能力限制是两个不同问题，必须同时具备。
10. 选型的核心不是“哪个产品最安全”，而是先明确威胁模型、信任边界和失败后的影响范围。

---

## 十五、后续研究路线

后续按照以下顺序逐步补充，不在第一版一次展开：

1. Linux Namespace、Cgroups、Capabilities、Seccomp 与 LSM 的关系；
2. runc 创建一个容器的完整调用链；
3. gVisor 的 Sentry、Gofer 和 syscall 拦截；
4. Kata 的 Runtime、Hypervisor、Guest Kernel 和 kata-agent；
5. Firecracker 的 KVM、VMM、Jailer 和 MicroVM 生命周期；
6. Pod 内文件沙箱：bind mount、只读根目录、Landlock；
7. Pod 内网络沙箱：Network Namespace、代理和 Egress Gateway；
8. `/proc`、Unix Socket、文件描述符和进程间通信风险；
9. Credential Broker、TLS 终止和短期身份；
10. Anthropic sandbox-runtime 源码实现；
11. 市面 Agent 沙箱产品的底层实现分类；
12. 结合实际 Kubernetes 集群形成最终选型与验证清单。

---

## 十六、主要参考资料

- [Kubernetes：Container Runtime Interface](https://kubernetes.io/docs/concepts/containers/cri/)
- [Kubernetes：Containers 与 RuntimeClass](https://kubernetes.io/docs/concepts/containers/)
- [Kubernetes：Linux Kernel Security Constraints](https://kubernetes.io/docs/concepts/security/linux-kernel-security-constraints/)
- [Open Container Initiative：Runtime Specification](https://specs.opencontainers.org/runtime-spec/runtime/)
- [Linux namespaces 概览](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [Linux Kernel：Cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html)
- [Linux Kernel：Landlock](https://docs.kernel.org/userspace-api/landlock.html)
- [gVisor：安全架构介绍](https://gvisor.dev/docs/architecture_guide/intro/)
- [gVisor：Platform Guide](https://gvisor.dev/docs/architecture_guide/platforms/)
- [Kata Containers：Architecture](https://github.com/kata-containers/kata-containers/blob/main/docs/design/architecture/README.md)
- [Kata Containers：Virtualization](https://github.com/kata-containers/kata-containers/blob/main/docs/design/virtualization.md)
- [Firecracker：项目与架构](https://github.com/firecracker-microvm/firecracker)
- [Firecracker：Design](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)
- [Anthropic sandbox-runtime 本地源码](/Users/zhouyuexing/.openclaw/workspace/me-agent/temp/sandbox-runtime)

