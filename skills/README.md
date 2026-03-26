# Skills 链接管理工具

本目录包含用于将 skills 软链接到不同 agent，或移除对应软链接的工具脚本。

## 支持的 Agent

- **Claude Code** - `~/.claude/skills`
- **Codex** - `~/.codex/skills`
- **OpenClaw** - `~/.openclaw/skills`

## 使用方法

### 基本用法

```bash
# 默认动作为 link，兼容旧用法
# 链接到单个 agent
./link-skill.sh <skill-name> claude

# 链接到多个 agent（用逗号分隔）
./link-skill.sh <skill-name> claude,codex

# 链接到所有 agent
./link-skill.sh <skill-name> all

# 显式指定创建软链接
./link-skill.sh link <skill-name> claude,codex

# 移除软链接
./link-skill.sh unlink <skill-name> codex
```

### 示例

```bash
# 将 zlx-note skill 链接到 Claude Code
./link-skill.sh zlx-note claude

# 将 zlx-note skill 链接到所有 agent
./link-skill.sh zlx-note all

# 将某个 skill 同时链接到 Codex 和 OpenClaw
./link-skill.sh my-skill codex,openclaw

# 显式创建到 Claude Code 和 Codex
./link-skill.sh link zlx-note claude,codex

# 从 Codex 移除 zlx-note 的软链接
./link-skill.sh unlink zlx-note codex
```

### 查看帮助

```bash
./link-skill.sh
# 或
./link-skill.sh --help
```

## 脚本特性

- ✓ 自动检测 skill 是否存在
- ✓ 智能处理已存在的软链接
- ✓ 支持覆盖已存在的链接
- ✓ 支持移除指定 agent 下的软链接
- ✓ 移除时只删除指向当前 skill 的软链接，避免误删其他目录
- ✓ 彩色输出，清晰显示状态
- ✓ 详细的错误提示

## 注意事项

1. `link` 会创建软链接，源文件保持在项目 `skills` 目录中
2. 如果目标位置已存在软链接，脚本会自动检查并更新
3. 如果目标位置存在普通文件或目录，执行 `link` 时会删除并替换为软链接
4. `unlink` 只会删除“指向当前 skill 源目录”的软链接；如果目标是普通文件、目录，或软链接指向别处，会跳过
5. 建议在修改 skill 后重新运行 `link` 以确保链接正确

## 可用的 Skills

运行以下命令查看当前可用的 skills：

```bash
./link-skill.sh
```
