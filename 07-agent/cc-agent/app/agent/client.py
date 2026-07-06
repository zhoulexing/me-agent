import inspect
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeSDKClient,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolUseBlock,
)

from app.agent.client_options import build_client_options
from app.agent.mcps.channel import create_channel_mcp
from app.agent.model import (
    AgentOnEvent,
    AgentOnFinish,
    AgentOnMessage,
    AgentOnTool,
    AgentRunContext,
)
from app.config import Settings


async def _emit(callback, event: Any) -> None:
    if callback is None:
        return
    result = callback(event)
    if inspect.isawaitable(result):
        await result


class AgentClientPool:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def query(
        self,
        session_key: str,
        prompt: str,
        context: AgentRunContext,
        run_id: int,
    ) -> None:
        client = ClaudeSDKClient(
            build_client_options(
                self._settings,
                continue_conversation=True,
                mcp_servers={"cc-agent-channel": create_channel_mcp(context)},
                allowed_tools=[
                    "send_image",
                    "send_file",
                    "mcp__cc-agent-channel__send_image",
                    "mcp__cc-agent-channel__send_file",
                ],
            )
        )
        await client.connect()
        try:
            await self._query_connected_client(client, session_key, prompt, context, run_id)
        finally:
            await client.disconnect()

    async def _query_connected_client(
        self,
        client: ClaudeSDKClient,
        session_key: str,
        prompt: str,
        context: AgentRunContext,
        run_id: int,
    ) -> None:
        await client.query(prompt, session_id=session_key)

        parts: list[str] = []
        message_count = 0
        result: ResultMessage | None = None
        agent_session_id: str | None = None

        async for message in client.receive_messages():
            message_count += 1
            message_session_id = getattr(message, "session_id", None)
            if message_session_id:
                agent_session_id = message_session_id

            if isinstance(message, AssistantMessage):
                await _emit(
                    context.on_event,
                    AgentOnEvent(
                        session_key=session_key,
                        event=message,
                        agent_session_id=message_session_id,
                    ),
                )
                for block in message.content:
                    if isinstance(block, TextBlock):
                        parts.append(block.text)
                        if context.stream:
                            await _emit(
                                context.on_message,
                                AgentOnMessage(
                                    session_key=session_key,
                                    text=block.text,
                                    agent_session_id=message.session_id,
                                    is_delta=True,
                                ),
                            )
                    elif isinstance(block, ToolUseBlock):
                        await _emit(
                            context.on_tool,
                            AgentOnTool(
                                session_key=session_key,
                                tool_id=block.id,
                                name=block.name,
                                input=block.input,
                                agent_session_id=message.session_id,
                            ),
                        )
            elif isinstance(message, SystemMessage):
                await _emit(
                    context.on_event,
                    AgentOnEvent(
                        session_key=session_key,
                        event=message,
                        agent_session_id=agent_session_id,
                        metadata={"subtype": message.subtype},
                    ),
                )
            elif isinstance(message, ResultMessage):
                await _emit(
                    context.on_event,
                    AgentOnEvent(
                        session_key=session_key,
                        event=message,
                        agent_session_id=message.session_id,
                    ),
                )
                result = message
                agent_session_id = message.session_id
                break
            else:
                await _emit(
                    context.on_event,
                    AgentOnEvent(
                        session_key=session_key,
                        event=message,
                        agent_session_id=message_session_id,
                    ),
                )

        text = "".join(parts)
        if text and not context.stream:
            await _emit(
                context.on_message,
                AgentOnMessage(
                    session_key=session_key,
                    text=text,
                    agent_session_id=agent_session_id,
                    is_delta=False,
                ),
            )

        await _emit(
            context.on_finish,
            AgentOnFinish(
                session_key=session_key,
                run_id=run_id,
                agent_session_id=agent_session_id,
                is_error=result.is_error if result else False,
                message_count=message_count,
                metadata={
                    "run_id": run_id,
                    "session_key": session_key,
                    "message_count": message_count,
                    "agent_session_id": agent_session_id,
                    "is_error": result.is_error if result else False,
                },
            ),
        )

    async def close(self) -> None:
        return None
