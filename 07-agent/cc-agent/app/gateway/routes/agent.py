from typing import Any

from fastapi import APIRouter, Request
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.agent.model import (
    AgentRunParams,
    AgentRunSource,
    ChannelId,
    NullAgentRunContext,
)

router = APIRouter()


class AgentRunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    channel_id: ChannelId = Field(validation_alias=AliasChoices("channelId", "channel_id"))
    app_id: str = Field(validation_alias=AliasChoices("appId", "app_id"))
    group_id: str = Field(validation_alias=AliasChoices("groupId", "group_id"))
    content: str = Field(validation_alias=AliasChoices("content", "text"))
    is_private: bool = Field(default=False, validation_alias=AliasChoices("isPrivate", "is_private"))
    source: AgentRunSource = "user"
    thread_id: str | None = Field(default=None, validation_alias=AliasChoices("threadId", "thread_id"))
    sender_id: str | None = Field(default=None, validation_alias=AliasChoices("senderId", "sender_id", "user_id"))
    sender_name: str | None = Field(default=None, validation_alias=AliasChoices("senderName", "sender_name"))
    reply_to: str | None = Field(
        default=None,
        validation_alias=AliasChoices("replyTo", "reply_to", "channelMessageId", "channel_message_id"),
    )


@router.post("/run")
async def run_agent(request: Request, body: AgentRunRequest) -> dict[str, Any]:
    params = AgentRunParams(
        channel_id=body.channel_id,
        app_id=body.app_id,
        group_id=body.group_id,
        thread_id=body.thread_id,
        sender_id=body.sender_id,
        sender_name=body.sender_name,
        reply_to=body.reply_to,
        content=body.content,
        is_private=body.is_private,
        source=body.source,
    )
    return await request.app.state.agent_session.run(params, NullAgentRunContext())
