from app.agent.model import AgentOnError, AgentOnMessage, AgentRunContext
from app.channels.wechat.client import WeChatClient


def create_wechat_context(client: WeChatClient, conversation_id: str) -> AgentRunContext:
    async def on_message(event: AgentOnMessage) -> None:
        if event.is_delta:
            return
        await client.send_text(conversation_id, event.text)

    async def on_error(event: AgentOnError) -> None:
        await client.send_text(conversation_id, f"Agent error: {event.message}")

    return AgentRunContext(stream=False, on_message=on_message, on_error=on_error)
