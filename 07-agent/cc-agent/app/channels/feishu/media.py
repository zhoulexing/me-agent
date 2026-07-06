from app.agent.model import AgentOnFile, AgentOnImage


async def handle_image_message(payload: dict) -> AgentOnImage:
    return AgentOnImage(url=payload.get("url"), alt=payload.get("alt"), metadata=payload)


async def handle_file_message(payload: dict) -> AgentOnFile:
    return AgentOnFile(
        url=payload.get("url"),
        name=payload.get("name"),
        mime_type=payload.get("mime_type"),
        metadata=payload,
    )

