# zlx-cc

这个目录是一个面向学习的 `Claude Code` 风格 CLI 骨架工程。

当前目标不是快速复刻全部能力，而是保持它的外层架构思路不变，按层逐步构建：

- `src/main.js`: 入口编排
- `src/commands.js`: 命令注册表
- `src/commands/*`: 具体命令
- `src/types/*`: 核心类型定义
- `src/utils/*`: 纯工具函数
- `src/services/*`: 外部系统和运行时服务
- `src/tools/*`: 后续工具系统
- `src/state/*`: 后续状态管理
- `src/entrypoints/*`: 后续初始化逻辑

## 当前里程碑

第一步只实现最小 CLI：

- 能启动
- 能显示帮助
- 帮助内容来自命令注册表
- 未知命令有稳定退出码

## 运行

```bash
cd 07-cc-agent
node ./bin/zlx-cc.js --help
```

如果后续想直接使用 `zlx-cc --help`，再做全局链接或本地 PATH 接入。
