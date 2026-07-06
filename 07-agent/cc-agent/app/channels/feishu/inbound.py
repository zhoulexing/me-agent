from app.agent.model import AgentRunParams, ChannelId
from app.agent.session import AgentSession
from app.channels.feishu.client import FeishuClient, FeishuReceivedMessage
from app.channels.feishu.outbound import create_feishu_context, resolve_send_target
from app.channels.feishu.streaming_card import FeishuStreamingCard


class FeishuInbound:
    def __init__(self, client: FeishuClient, agent_session: AgentSession) -> None:
        self._client = client
        self._agent_session = agent_session

    async def handle_message(self, message: FeishuReceivedMessage) -> dict:
        if not message.chat_id or not message.text.strip():
            return {"status": "ignored"}

        params = AgentRunParams(
            channel_id=ChannelId.FEISHU,
            app_id=self._client.app_id,
            group_id=message.chat_id,
            thread_id=message.thread_id,
            sender_id=message.sender_id,
            sender_name=message.sender_name,
            reply_to=message.message_id,
            content=message.text,
            is_private=message.chat_type == "p2p",
            source="user",
        )
        reaction_id = await self._client.add_reaction(message.message_id, "Get")
        card = FeishuStreamingCard(self._client, resolve_send_target(params))
        await card.start()
        if card.streaming_ready:
            await self._client.delete_reaction(message.message_id, reaction_id)

        context = create_feishu_context(card)
        try:
            return await self._agent_session.run(params, context)
        except Exception:
            await card.finish(is_error=True)
            raise
        finally:
            await self._client.delete_reaction(message.message_id, reaction_id)
