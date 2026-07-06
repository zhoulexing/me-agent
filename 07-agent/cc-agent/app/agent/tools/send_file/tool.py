from pathlib import Path
from typing import Any

from claude_agent_sdk import tool

from app.agent.model import AgentOnFile, AgentRunContext
from app.agent.tools._shared import emit
from app.agent.tools.send_file.schema import SEND_FILE_SCHEMA


def create_send_file_tool(context: AgentRunContext):
    @tool(
        "send_file",
        "Send a file to the active channel conversation.",
        SEND_FILE_SCHEMA,
    )
    async def send_file(args: dict[str, Any]) -> dict[str, Any]:
        path = args.get("path") or None
        await emit(
            context.on_file,
            AgentOnFile(
                path=Path(path) if path else None,
                url=args.get("url") or None,
                name=args.get("name") or None,
                mime_type=args.get("mime_type") or None,
            ),
        )
        return {"content": [{"type": "text", "text": "file sent"}]}

    return send_file

