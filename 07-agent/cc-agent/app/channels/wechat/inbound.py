from app.agent.model import AgentRunParams, ChannelId
from app.agent.session import AgentSession
from app.channels.wechat.client import WeChatClient
from app.channels.wechat.outbound import create_wechat_context


class WeChatInbound:
    def __init__(self, client: WeChatClient, agent_session: AgentSession) -> None:
        self._client = client
        self._agent_session = agent_session

    async def handle_message(self, event: dict) -> dict:
        conversation_id = event.get("conversation_id", "")
        params = AgentRunParams(
            channel_id=ChannelId.WECHAT,
            app_id=event.get("app_id", ""),
            group_id=conversation_id,
            thread_id=event.get("thread_id"),
            sender_id=event.get("user_id", ""),
            sender_name=event.get("sender_name"),
            reply_to=event.get("message_id"),
            content=event.get("text", ""),
            is_private=event.get("is_private", False),
            source="user",
        )
        context = create_wechat_context(self._client, conversation_id=conversation_id)
        return await self._agent_session.run(params, context)
