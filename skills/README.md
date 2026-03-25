# Skills 链接管理工具

本目录包含用于将 skills 软链接到不同 agent 的工具脚本。

## 支持的 Agent

- **Claude Code** - `~/.claude/skills`
- **Codex** - `~/.codex/skills`
- **OpenClaw** - `~/.openclaw/skills`

## 使用方法

### 基本用法

```bash
# 链接到单个 agent
./link-skill.sh <skill-name> claude

# 链接到多个 agent（用逗号分隔）
./link-skill.sh <skill-name> claude,codex

# 链接到所有 agent
./link-skill.sh <skill-name> all
```

### 示例

```bash
# 将 zlx-note skill 链接到 Claude Code
./link-skill.sh zlx-note claude

# 将 zlx-note skill 链接到所有 agent
./link-skill.sh zlx-note all

# 将某个 skill 同时链接到 Codex 和 OpenClaw
./link-skill.sh my-skill codex,openclaw
```

### 查看帮助

```bash
./link-skill.sh
```

## 脚本特性

- ✓ 自动检测 skill 是否存在
- ✓ 智能处理已存在的软链接
- ✓ 支持覆盖已存在的链接
- ✓ 彩色输出，清晰显示状态
- ✓ 详细的错误提示

## 注意事项

1. 脚本会创建软链接，源文件保持在项目 skills 目录中
2. 如果目标位置已存在软链接，会自动检查并更新
3. 如果目标位置存在普通文件或目录，会被删除并替换为软链接
4. 建议在修改 skill 后重新运行脚本以确保链接正确

## 可用的 Skills

运行以下命令查看当前可用的 skills：

```bash
./link-skill.sh
```
