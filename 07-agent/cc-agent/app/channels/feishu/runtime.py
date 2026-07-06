import asyncio
import logging

from app.agent.session import AgentSession
from app.channels.feishu.client import FeishuClient, FeishuReceivedMessage
from app.channels.feishu.inbound import FeishuInbound
from app.config import Settings

logger = logging.getLogger(__name__)


class FeishuRuntime:
    def __init__(self, settings: Settings, client: FeishuClient, agent_session: AgentSession) -> None:
        self._settings = settings
        self._client = client
        self._inbound = FeishuInbound(client, agent_session)
        self._loop: asyncio.AbstractEventLoop | None = None

    async def start(self) -> None:
        if not self._settings.feishu_enabled:
            logger.info("feishu channel disabled")
            return
        self._loop = asyncio.get_running_loop()
        self._client.start_websocket(self._submit_message)

    async def stop(self) -> None:
        await self._client.stop_websocket()

    def _submit_message(self, message: FeishuReceivedMessage) -> None:
        if self._loop is None:
            logger.warning("feishu message dropped because runtime loop is unavailable")
            return
        future = asyncio.run_coroutine_threadsafe(self._inbound.handle_message(message), self._loop)
        future.add_done_callback(self._log_task_error)

    @staticmethod
    def _log_task_error(future) -> None:
        try:
            future.result()
        except Exception:
            logger.exception("feishu message handling failed")
