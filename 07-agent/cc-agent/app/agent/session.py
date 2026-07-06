import inspect
from dataclasses import dataclass, field
from typing import Any

from app.agent.client import AgentClientPool
from app.agent.model import (
    AgentOnError,
    AgentOnFinish,
    AgentOnMessage,
    AgentRunContext,
    AgentRunParams,
)
from app.agent.prompt_builder import build_user_prompt
from app.agent.queue import SessionQueue
from app.agent.session_key import build_session_key
from app.agent.session_store import SessionStore


async def _emit(callback, event: Any) -> None:
    if callback is None:
        return
    result = callback(event)
    if inspect.isawaitable(result):
        await result


@dataclass
class _RunCapture:
    text_parts: list[str] = field(default_factory=list)
    finish: AgentOnFinish | None = None


class AgentSession:
    def __init__(self, client_pool: AgentClientPool, session_store: SessionStore) -> None:
        self._client_pool = client_pool
        self._session_store = session_store
        self._queue = SessionQueue()

    async def run(self, params: AgentRunParams, context: AgentRunContext) -> dict[str, Any]:
        session_key = build_session_key(params.channel_id.value, params.app_id, params.group_id)

        async def task() -> dict[str, Any]:
            return await self._run_locked(session_key, params, context)

        return await self._queue.run(session_key, task)

    async def _run_locked(
        self, session_key: str, params: AgentRunParams, context: AgentRunContext
    ) -> dict[str, Any]:
        await self._session_store.sessions.upsert(session_key)
        run_id = await self._session_store.runs.create(
            session_key,
            {
                "source": params.source,
                "thread_id": params.thread_id,
                "sender_id": params.sender_id,
                "sender_name": params.sender_name,
                "reply_to": params.reply_to,
                "is_private": params.is_private,
            },
        )
        await self._session_store.messages.create(
            session_key=session_key,
            role="user",
            content=params.content,
            metadata={
                "source": params.source,
                "thread_id": params.thread_id,
                "sender_id": params.sender_id,
                "sender_name": params.sender_name,
                "reply_to": params.reply_to,
                "is_private": params.is_private,
            },
        )

        try:
            capture = _RunCapture()

            async def on_message(event: AgentOnMessage) -> None:
                capture.text_parts.append(event.text)
                await _emit(context.on_message, event)

            async def on_finish(event: AgentOnFinish) -> None:
                capture.finish = event
                await _emit(context.on_finish, event)

            client_context = AgentRunContext(
                stream=context.stream,
                on_message=on_message,
                on_tool=context.on_tool,
                on_image=context.on_image,
                on_file=context.on_file,
                on_finish=on_finish,
                on_error=context.on_error,
                on_event=context.on_event,
            )
            await self._client_pool.query(
                session_key=session_key,
                prompt=build_user_prompt(params),
                context=client_context,
                run_id=run_id,
            )

            assistant_text = "".join(capture.text_parts)
            finish = capture.finish
            if assistant_text:
                await self._session_store.messages.create(
                    session_key=session_key,
                    role="assistant",
                    content=assistant_text,
                    metadata={"agent_session_id": finish.agent_session_id if finish else None},
                )

            result = {
                "run_id": run_id,
                "session_key": session_key,
                "message_count": finish.message_count if finish else 0,
                "agent_session_id": finish.agent_session_id if finish else None,
                "is_error": finish.is_error if finish else False,
            }
            await self._session_store.runs.finish(run_id, status="completed", result=result)
            return result
        except Exception as error:
            await self._session_store.runs.finish(run_id, status="failed", result={"error": str(error)})
            await _emit(
                context.on_error,
                AgentOnError(session_key=session_key, error=error, message=str(error)),
            )
            raise
