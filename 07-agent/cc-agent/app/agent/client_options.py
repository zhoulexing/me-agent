import os

from claude_agent_sdk import ClaudeAgentOptions

from app.agent.prompt_builder import build_system_prompt
from app.config import Settings


def build_client_options(settings: Settings, **overrides) -> ClaudeAgentOptions:
    env = {
        **os.environ,
        "ANTHROPIC_BASE_URL": settings.anthropic_base_url,
        "ANTHROPIC_MODEL": settings.anthropic_model,
    }
    if settings.anthropic_auth_token:
        env["ANTHROPIC_AUTH_TOKEN"] = settings.anthropic_auth_token

    values = {
        "cwd": settings.workdir,
        "env": env,
        "model": settings.anthropic_model,
        "max_turns": settings.max_turns,
        "permission_mode": settings.permission_mode,
        "system_prompt": build_system_prompt(),
    }
    values.update(overrides)
    return ClaudeAgentOptions(**values)
