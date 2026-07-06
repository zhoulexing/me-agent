from app.agent.model import (
    AgentOnError,
    AgentOnFinish,
    AgentOnFile,
    AgentOnImage,
    AgentOnMessage,
    AgentOnTool,
    AgentRunContext,
    AgentRunParams,
)
from app.channels.feishu.client import FeishuSendTarget
from app.channels.feishu.streaming_card import FeishuStreamingCard


def create_feishu_context(card: FeishuStreamingCard) -> AgentRunContext:
    async def on_message(event: AgentOnMessage) -> None:
        await card.add_assistant(event.text)

    async def on_tool(event: AgentOnTool) -> None:
        await card.add_tool(format_tool_event(event))

    async def on_image(event: AgentOnImage) -> None:
        if event.path is None:
            await card.add_tool("send_image\n缺少本地图片路径，无法发送")
            return
        await card.client.send_image(card.target, str(event.path))

    async def on_file(event: AgentOnFile) -> None:
        if event.path is None:
            await card.add_tool("send_file\n缺少本地文件路径，无法发送")
            return
        await card.client.send_file(card.target, str(event.path), event.name)

    async def on_error(event: AgentOnError) -> None:
        card.error_text = event.message

    async def on_finish(event: AgentOnFinish) -> None:
        await card.finish(event.is_error)

    return AgentRunContext(
        stream=True,
        on_message=on_message,
        on_tool=on_tool,
        on_image=on_image,
        on_file=on_file,
        on_error=on_error,
        on_finish=on_finish,
    )


def resolve_send_target(message: AgentRunParams) -> FeishuSendTarget:
    return FeishuSendTarget(
        receive_id_type="chat_id",
        receive_id=message.group_id,
        reply_to=message.reply_to,
        reply_in_thread=bool(message.thread_id),
    )


def format_tool_event(event: AgentOnTool) -> str:
    if not event.input:
        return event.name
    return f"{event.name}\n{event.input}"
