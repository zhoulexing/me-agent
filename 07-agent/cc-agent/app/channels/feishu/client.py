import asyncio
import json
import logging
from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Thread
from typing import Any

import lark_oapi as lark
from lark_oapi.api.im.v1 import (
    CreateMessageRequest,
    CreateMessageReactionRequest,
    CreateMessageReactionRequestBody,
    CreateMessageRequestBody,
    CreateFileRequest,
    CreateFileRequestBody,
    CreateImageRequest,
    CreateImageRequestBody,
    DeleteMessageReactionRequest,
    Emoji,
    P2ImMessageReceiveV1,
    ReplyMessageRequest,
    ReplyMessageRequestBody,
)
from lark_oapi.api.cardkit.v1 import (
    Card,
    ContentCardElementRequest,
    ContentCardElementRequestBody,
    CreateCardRequest,
    CreateCardRequestBody,
    SettingsCardRequest,
    SettingsCardRequestBody,
    UpdateCardRequest,
    UpdateCardRequestBody,
)

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FeishuReceivedMessage:
    event_id: str | None
    message_id: str | None
    chat_id: str | None
    chat_type: str | None
    sender_id: str | None
    sender_name: str | None
    thread_id: str | None
    text: str
    raw: Any


@dataclass(frozen=True)
class FeishuSendTarget:
    receive_id_type: str
    receive_id: str
    reply_to: str | None = None
    reply_in_thread: bool = False


class MessageDedup:
    def __init__(self, max_size: int = 512) -> None:
        self._max_size = max_size
        self._keys: list[str] = []
        self._seen: set[str] = set()

    def is_duplicate(self, key: str | None) -> bool:
        if not key:
            return False
        if key in self._seen:
            return True
        self._seen.add(key)
        self._keys.append(key)
        if len(self._keys) > self._max_size:
            old = self._keys.pop(0)
            self._seen.discard(old)
        return False


class FeishuClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._dedup = MessageDedup()
        self._ws_client: lark.ws.Client | None = None
        self._ws_thread: Thread | None = None
        self._sdk_client = None

        if not settings.feishu_enabled:
            return
        if not settings.feishu_app_id:
            raise ValueError("Missing FEISHU_APP_ID")
        if not settings.feishu_app_secret:
            raise ValueError("Missing FEISHU_APP_SECRET")

        self._sdk_client = (
            lark.Client.builder()
            .app_id(settings.feishu_app_id)
            .app_secret(settings.feishu_app_secret)
            .log_level(lark.LogLevel.INFO)
            .source("cc-agent")
            .build()
        )

    @property
    def enabled(self) -> bool:
        return self._settings.feishu_enabled

    @property
    def app_id(self) -> str:
        return self._settings.feishu_app_id

    def start_websocket(self, on_message: Callable[[FeishuReceivedMessage], None]) -> None:
        if not self.enabled:
            return
        if self._ws_client is not None:
            return

        handler = (
            lark.EventDispatcherHandler.builder(
                self._settings.feishu_encrypt_key,
                self._settings.feishu_verification_token,
                lark.LogLevel.INFO,
            )
            .register_p2_im_message_receive_v1(lambda event: self._handle_message(event, on_message))
            .register_p2_im_message_reaction_created_v1(lambda event: None)
            .register_p2_im_message_reaction_deleted_v1(lambda event: None)
            .register_p2_im_message_message_read_v1(lambda event: None)
            .build()
        )

        self._ws_client = lark.ws.Client(
            self._settings.feishu_app_id,
            self._settings.feishu_app_secret,
            log_level=lark.LogLevel.INFO,
            event_handler=handler,
            auto_reconnect=True,
            source="cc-agent",
        )
        self._ws_client.on_reconnecting = lambda: logger.warning("feishu websocket reconnecting")
        self._ws_client.on_reconnected = lambda: logger.info("feishu websocket reconnected")

        self._ws_thread = Thread(target=self._run_websocket, name="feishu-ws", daemon=True)
        self._ws_thread.start()

    async def stop_websocket(self) -> None:
        if self._ws_client is None:
            return
        disconnect = getattr(self._ws_client, "_disconnect", None)
        if disconnect is not None:
            try:
                await disconnect()
            except Exception:
                logger.exception("feishu websocket disconnect failed")
        self._ws_client = None

    async def send_text(self, target: FeishuSendTarget | str, text: str) -> None:
        if isinstance(target, str):
            target = FeishuSendTarget(receive_id_type="chat_id", receive_id=target)
        await self.send_message_content(target, "text", {"text": text})

    async def send_image(self, target: FeishuSendTarget, file_path: str) -> None:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")
        with Path(file_path).open("rb") as image_file:
            body = (
                CreateImageRequestBody.builder()
                .image_type("message")
                .image(image_file)
                .build()
            )
            request = CreateImageRequest.builder().request_body(body).build()
            response = await asyncio.to_thread(self._sdk_client.im.v1.image.create, request)
        if not response.success():
            raise RuntimeError(
                f"Feishu upload image failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )
        image_key = getattr(response.data, "image_key", None)
        if not image_key:
            raise RuntimeError("Feishu upload image response missing image_key")
        await self.send_message_content(target, "image", {"image_key": image_key})

    async def send_file(self, target: FeishuSendTarget, file_path: str, file_name: str | None = None) -> None:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")
        path = Path(file_path)
        name = file_name or path.name
        with path.open("rb") as file:
            body = (
                CreateFileRequestBody.builder()
                .file_type(infer_feishu_file_type(name))
                .file_name(name)
                .file(file)
                .build()
            )
            request = CreateFileRequest.builder().request_body(body).build()
            response = await asyncio.to_thread(self._sdk_client.im.v1.file.create, request)
        if not response.success():
            raise RuntimeError(
                f"Feishu upload file failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )
        file_key = getattr(response.data, "file_key", None)
        if not file_key:
            raise RuntimeError("Feishu upload file response missing file_key")
        await self.send_message_content(target, "file", {"file_key": file_key})

    async def send_message_content(
        self,
        target: FeishuSendTarget,
        msg_type: str,
        content: dict[str, Any],
    ) -> None:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")

        content_json = json.dumps(content, ensure_ascii=False)
        if target.reply_to:
            body = (
                ReplyMessageRequestBody.builder()
                .content(content_json)
                .msg_type(msg_type)
                .reply_in_thread(target.reply_in_thread)
                .build()
            )
            request = (
                ReplyMessageRequest.builder()
                .message_id(target.reply_to)
                .request_body(body)
                .build()
            )
            response = await asyncio.to_thread(self._sdk_client.im.v1.message.reply, request)
        else:
            body = (
                CreateMessageRequestBody.builder()
                .receive_id(target.receive_id)
                .content(content_json)
                .msg_type(msg_type)
                .build()
            )
            request = (
                CreateMessageRequest.builder()
                .receive_id_type(target.receive_id_type)
                .request_body(body)
                .build()
            )
            response = await asyncio.to_thread(self._sdk_client.im.v1.message.create, request)

        if not response.success():
            raise RuntimeError(
                f"Feishu send failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )

    async def create_card_instance(self, card: dict[str, Any]) -> str:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")
        body = (
            CreateCardRequestBody.builder()
            .type("card_json")
            .data(json.dumps(card, ensure_ascii=False))
            .build()
        )
        request = CreateCardRequest.builder().request_body(body).build()
        response = await asyncio.to_thread(self._sdk_client.cardkit.v1.card.create, request)
        if not response.success():
            raise RuntimeError(
                f"Feishu create card failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )
        card_id = getattr(response.data, "card_id", None)
        if not card_id:
            raise RuntimeError("Feishu create card response missing card_id")
        return card_id

    async def send_card_reference(self, target: FeishuSendTarget, card_id: str) -> None:
        await self.send_message_content(
            target,
            "interactive",
            {"type": "card", "data": {"card_id": card_id}},
        )

    async def update_card_instance(self, card_id: str, card: dict[str, Any], sequence: int) -> None:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")
        card_body = (
            Card.builder()
            .type("card_json")
            .data(json.dumps(card, ensure_ascii=False))
            .build()
        )
        body = (
            UpdateCardRequestBody.builder()
            .card(card_body)
            .sequence(sequence)
            .uuid(f"card_{card_id}_{sequence}")
            .build()
        )
        request = UpdateCardRequest.builder().card_id(card_id).request_body(body).build()
        response = await asyncio.to_thread(self._sdk_client.cardkit.v1.card.update, request)
        if not response.success():
            raise RuntimeError(
                f"Feishu update card failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )

    async def update_card_element_content(
        self,
        card_id: str,
        element_id: str,
        content: str,
        sequence: int,
    ) -> None:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")
        body = (
            ContentCardElementRequestBody.builder()
            .content(content)
            .sequence(sequence)
            .uuid(f"element_{card_id}_{element_id}_{sequence}")
            .build()
        )
        request = (
            ContentCardElementRequest.builder()
            .card_id(card_id)
            .element_id(element_id)
            .request_body(body)
            .build()
        )
        response = await asyncio.to_thread(self._sdk_client.cardkit.v1.card_element.content, request)
        if not response.success():
            raise RuntimeError(
                f"Feishu update card element failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )

    async def finish_streaming_card(self, card_id: str, summary: str, sequence: int) -> None:
        if self._sdk_client is None:
            raise RuntimeError("Feishu client is disabled")
        body = (
            SettingsCardRequestBody.builder()
            .settings(
                json.dumps(
                    {"config": {"streaming_mode": False, "summary": {"content": summary}}},
                    ensure_ascii=False,
                )
            )
            .sequence(sequence)
            .uuid(f"settings_{card_id}_{sequence}")
            .build()
        )
        request = SettingsCardRequest.builder().card_id(card_id).request_body(body).build()
        response = await asyncio.to_thread(self._sdk_client.cardkit.v1.card.settings, request)
        if not response.success():
            raise RuntimeError(
                f"Feishu finish streaming card failed: code={response.code} msg={response.msg} log_id={response.get_log_id()}"
            )

    async def add_reaction(self, message_id: str | None, emoji_type: str) -> str | None:
        if not message_id or self._sdk_client is None:
            return None
        body = (
            CreateMessageReactionRequestBody.builder()
            .reaction_type(Emoji.builder().emoji_type(emoji_type).build())
            .build()
        )
        request = CreateMessageReactionRequest.builder().message_id(message_id).request_body(body).build()
        try:
            response = await asyncio.to_thread(self._sdk_client.im.v1.message_reaction.create, request)
            if not response.success():
                logger.warning(
                    "feishu add reaction failed: code=%s msg=%s log_id=%s",
                    response.code,
                    response.msg,
                    response.get_log_id(),
                )
                return None
            return getattr(response.data, "reaction_id", None)
        except Exception:
            logger.exception("feishu add reaction failed: message_id=%s", message_id)
            return None

    async def delete_reaction(self, message_id: str | None, reaction_id: str | None) -> None:
        if not message_id or not reaction_id or self._sdk_client is None:
            return
        request = (
            DeleteMessageReactionRequest.builder()
            .message_id(message_id)
            .reaction_id(reaction_id)
            .build()
        )
        try:
            response = await asyncio.to_thread(self._sdk_client.im.v1.message_reaction.delete, request)
            if not response.success():
                logger.warning(
                    "feishu delete reaction failed: code=%s msg=%s log_id=%s",
                    response.code,
                    response.msg,
                    response.get_log_id(),
                )
        except Exception:
            logger.exception("feishu delete reaction failed: message_id=%s", message_id)

    def _run_websocket(self) -> None:
        assert self._ws_client is not None
        try:
            logger.info("feishu websocket starting: app_id=%s", self._settings.feishu_app_id)
            self._ws_client.start()
        except Exception:
            logger.exception("feishu websocket stopped with error")

    def _handle_message(
        self,
        event: P2ImMessageReceiveV1,
        on_message: Callable[[FeishuReceivedMessage], None],
    ) -> None:
        message = normalize_feishu_event(event)
        if message is None:
            return
        if self._dedup.is_duplicate(message.message_id or message.event_id):
            return
        logger.info(
            "feishu message received: %s",
            {key: value for key, value in asdict(message).items() if key != "raw"},
        )
        on_message(message)


def normalize_feishu_event(event: P2ImMessageReceiveV1) -> FeishuReceivedMessage | None:
    data = getattr(event, "event", None)
    message = getattr(data, "message", None)
    if message is None:
        return None

    text = extract_text_content(getattr(message, "content", None))
    sender = getattr(data, "sender", None)
    sender_id_obj = getattr(sender, "sender_id", None)
    sender_id = (
        getattr(sender_id_obj, "open_id", None)
        or getattr(sender_id_obj, "user_id", None)
        or getattr(sender_id_obj, "union_id", None)
    )

    return FeishuReceivedMessage(
        event_id=getattr(event, "event_id", None),
        message_id=getattr(message, "message_id", None),
        chat_id=getattr(message, "chat_id", None),
        chat_type=getattr(message, "chat_type", None),
        sender_id=sender_id,
        sender_name=None,
        thread_id=getattr(message, "thread_id", None),
        text=text,
        raw=event,
    )


def extract_text_content(content: Any) -> str:
    if content is None:
        return ""
    if not isinstance(content, str):
        return str(content)
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return content
    text = parsed.get("text")
    return text if isinstance(text, str) else ""


def infer_feishu_file_type(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix in {".mp4", ".mov", ".avi", ".mkv"}:
        return "mp4"
    if suffix in {".mp3", ".wav", ".m4a", ".aac"}:
        return "mp3"
    if suffix in {".pdf"}:
        return "pdf"
    if suffix in {".doc", ".docx"}:
        return "doc"
    if suffix in {".xls", ".xlsx"}:
        return "xls"
    if suffix in {".ppt", ".pptx"}:
        return "ppt"
    return "stream"
