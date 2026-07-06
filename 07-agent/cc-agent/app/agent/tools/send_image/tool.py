from pathlib import Path
from typing import Any

from claude_agent_sdk import tool

from app.agent.model import AgentOnImage, AgentRunContext
from app.agent.tools._shared import emit
from app.agent.tools.send_image.schema import SEND_IMAGE_SCHEMA


def create_send_image_tool(context: AgentRunContext):
    @tool(
        "send_image",
        "Send an image to the active channel conversation.",
        SEND_IMAGE_SCHEMA,
    )
    async def send_image(args: dict[str, Any]) -> dict[str, Any]:
        path = args.get("path") or None
        await emit(
            context.on_image,
            AgentOnImage(
                path=Path(path) if path else None,
                url=args.get("url") or None,
                alt=args.get("alt") or None,
            ),
        )
        return {"content": [{"type": "text", "text": "image sent"}]}

    return send_image

