from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Literal


class ChannelId(StrEnum):
    FEISHU = "feishu"
    WECHAT = "wechat"


AgentRunSource = Literal["user", "scheduled", "background"]


@dataclass(frozen=True)
class AgentOnImage:
    path: Path | None = None
    url: str | None = None
    alt: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentOnFile:
    path: Path | None = None
    url: str | None = None
    name: str | None = None
    mime_type: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentOnMessage:
    session_key: str
    text: str
    agent_session_id: str | None = None
    is_delta: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentOnTool:
    session_key: str
    tool_id: str
    name: str
    input: dict[str, Any]
    agent_session_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentOnFinish:
    session_key: str
    run_id: int
    agent_session_id: str | None
    is_error: bool
    message_count: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentOnError:
    session_key: str
    error: Exception
    message: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentOnEvent:
    session_key: str
    event: Any
    agent_session_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentRunParams:
    channel_id: ChannelId
    app_id: str
    group_id: str
    content: str
    is_private: bool
    source: AgentRunSource
    thread_id: str | None = None
    sender_id: str | None = None
    sender_name: str | None = None
    reply_to: str | None = None


Callback = Callable[[Any], None | Awaitable[None]]


@dataclass
class AgentRunContext:
    stream: bool = False
    on_message: Callback | None = None
    on_tool: Callback | None = None
    on_image: Callback | None = None
    on_file: Callback | None = None
    on_finish: Callback | None = None
    on_error: Callback | None = None
    on_event: Callback | None = None


AgentRunCallbacks = AgentRunContext


class NullAgentRunContext(AgentRunContext):
    pass


NullAgentRunCallbacks = NullAgentRunContext
