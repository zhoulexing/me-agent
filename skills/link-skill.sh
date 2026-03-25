#!/bin/bash

# link-skill.sh - 将本项目的 skill 软链接到不同 agent
# 用法: ./link-skill.sh <skill-name> <agent1,agent2,...>
# 示例: ./link-skill.sh zlx-note claude,codex
#       ./link-skill.sh zlx-note all

# 获取脚本所在目录的父目录（项目根目录）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/skills"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo "用法: $0 <skill-name> <agent-list>"
    echo ""
    echo "参数:"
    echo "  skill-name    - skills 目录下的 skill 文件夹名称"
    echo "  agent-list    - 目标 agent，多个用逗号分隔，或使用 'all'"
    echo ""
    echo "支持的 agent:"
    echo "  claude        - Claude Code (~/.claude/skills)"
    echo "  codex         - Codex (~/.codex/skills)"
    echo "  openclaw      - OpenClaw (~/.openclaw/skills)"
    echo "  all           - 所有 agent"
    echo ""
    echo "示例:"
    echo "  $0 zlx-note claude                    # 链接到 claude"
    echo "  $0 zlx-note claude,codex              # 链接到 claude 和 codex"
    echo "  $0 zlx-note all                       # 链接到所有 agent"
    echo ""
    echo "可用的 skills:"
    ls -1 "$SKILLS_DIR" 2>/dev/null | grep -v "^link-" | grep -v "^README.md$" | sed 's/^/  /' || echo "  (无)"
}

# 获取 agent 的 skills 目录
get_agent_dir() {
    local agent="$1"
    case "$agent" in
        "claude")
            echo "$HOME/.claude/skills"
            ;;
        "codex")
            echo "$HOME/.codex/skills"
            ;;
        "openclaw")
            echo "$HOME/.openclaw/skills"
            ;;
        *)
            echo ""
            ;;
    esac
}

# 检查 skill 是否存在
check_skill_exists() {
    local skill_name="$1"
    local skill_path="$SKILLS_DIR/$skill_name"

    if [[ ! -d "$skill_path" ]]; then
        echo -e "${RED}错误: Skill '$skill_name' 不存在${NC}"
        echo ""
        echo "可用的 skills:"
        ls -1 "$SKILLS_DIR" 2>/dev/null | grep -v "^link-" | grep -v "^README.md$" | sed 's/^/  /' || echo "  (无)"
        exit 1
    fi

    # 检查 SKILL.md 是否存在
    if [[ ! -f "$skill_path/SKILL.md" ]]; then
        echo -e "${RED}错误: Skill '$skill_name' 缺少 SKILL.md 文件${NC}"
        exit 1
    fi
}

# 检查 agent 是否有效
is_valid_agent() {
    local agent="$1"
    case "$agent" in
        "claude"|"codex"|"openclaw")
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# 创建软链接
create_link() {
    local skill_name="$1"
    local agent="$2"
    local target_dir=$(get_agent_dir "$agent")
    local source_path="$SKILLS_DIR/$skill_name"
    local target_path="$target_dir/$skill_name"

    # 检查目标目录是否存在
    if [[ -z "$target_dir" ]]; then
        echo -e "${RED}内部错误: 无法获取 $agent 的目录${NC}"
        return 1
    fi

    if [[ ! -d "$target_dir" ]]; then
        echo -e "${YELLOW}警告: $agent 的 skills 目录不存在: $target_dir${NC}"
        echo -e "  跳过 $agent"
        return 1
    fi

    # 检查是否已存在
    if [[ -e "$target_path" ]]; then
        if [[ -L "$target_path" ]]; then
            # 已是软链接，检查是否指向正确位置
            local current_link="$(readlink "$target_path")"
            if [[ "$current_link" == "$source_path" ]]; then
                echo -e "${GREEN}✓${NC} $agent: 已经是正确的软链接"
                return 0
            else
                echo -e "${YELLOW}! $agent: 已存在其他软链接，将被覆盖${NC}"
                rm "$target_path"
            fi
        else
            echo -e "${YELLOW}! $agent: 目标位置已存在文件/目录，将被删除${NC}"
            rm -rf "$target_path"
        fi
    fi

    # 创建软链接
    ln -s "$source_path" "$target_path"

    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓${NC} $agent: 成功创建软链接"
        echo -e "  $target_path -> $source_path"
        return 0
    else
        echo -e "${RED}✗${NC} $agent: 创建软链接失败"
        return 1
    fi
}

# 主逻辑
main() {
    # 检查参数
    if [[ $# -lt 2 ]]; then
        show_help
        exit 1
    fi

    local skill_name="$1"
    local agents_input="$2"

    # 检查 skill 是否存在
    check_skill_exists "$skill_name"

    echo "正在为 skill '$skill_name' 创建软链接..."
    echo "源路径: $SKILLS_DIR/$skill_name"
    echo ""

    # 解析 agent 列表
    local agents=()
    if [[ "$agents_input" == "all" ]]; then
        agents=("claude" "codex" "openclaw")
    else
        IFS=',' read -ra agents <<< "$agents_input"
    fi

    # 验证 agent 名称
    for agent in "${agents[@]}"; do
        agent=$(echo "$agent" | xargs) # 去除空格
        if ! is_valid_agent "$agent"; then
            echo -e "${RED}错误: 不支持的 agent '$agent'${NC}"
            echo "支持的 agent: claude, codex, openclaw, all"
            exit 1
        fi
    done

    # 创建软链接
    local success_count=0
    local total_count=${#agents[@]}

    for agent in "${agents[@]}"; do
        agent=$(echo "$agent" | xargs) # 去除空格
        if create_link "$skill_name" "$agent"; then
            ((success_count++))
        fi
    done

    echo ""
    echo "完成: $success_count/$total_count 个 agent 链接成功"
}

# 运行主函数
main "$@"
