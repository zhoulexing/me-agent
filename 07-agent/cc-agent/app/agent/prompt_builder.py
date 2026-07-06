from pathlib import Path

from app.agent.model import AgentRunParams


PROMPT_DIR = Path(__file__).parent / "prompts"


def build_system_prompt() -> str:
    parts: list[str] = []
    for name in ("AGENTS.md", "TOOL.md", "SOUL.md"):
        path = PROMPT_DIR / name
        if path.exists():
            parts.append(path.read_text(encoding="utf-8").strip())
    return "\n\n".join(part for part in parts if part)


def build_user_prompt(params: AgentRunParams) -> str:
    return params.content
