import asyncio
import logging
import time
from dataclasses import dataclass, field
from collections.abc import Awaitable, Callable
from typing import Literal

from app.channels.feishu.client import FeishuClient, FeishuSendTarget

logger = logging.getLogger(__name__)

FEISHU_STREAM_CONTENT_ELEMENT_ID = "streaming_content"
FEISHU_LOADING_ELEMENT_ID = "loading_indicator"
FeishuStreamingPhase = Literal["thinking", "answering", "tool"]


@dataclass
class FeishuStreamingCard:
    client: FeishuClient
    target: FeishuSendTarget
    assistant_text: str = ""
    tool_messages: list[str] = field(default_factory=list)
    error_text: str | None = None
    started_at: float = field(default_factory=time.monotonic)
    flush_interval_ms: int = 700

    card_id: str = ""
    sequence: int = 0
    phase: FeishuStreamingPhase = "thinking"
    loading_tick: int = 0
    streaming_ready: bool = False
    _last_flush_at: float = 0
    _last_flushed_length: int = 0
    _loading_task: asyncio.Task | None = None
    _update_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def start(self) -> None:
        if self.streaming_ready:
            return
        try:
            self.card_id = await self.client.create_card_instance(
                build_streaming_card(self.assistant_text, self.tool_messages, self.phase)
            )
            await self.client.send_card_reference(self.target, self.card_id)
            self.streaming_ready = True
            self._start_loading_ticker()
        except Exception:
            self.streaming_ready = False
            logger.exception("feishu streaming card start failed, fallback to static text")

    async def add_assistant(self, content: str) -> None:
        if not content:
            return
        self.assistant_text += content
        if not self.streaming_ready:
            return
        try:
            if self.phase != "answering":
                self.phase = "answering"
                await self._update_card(build_streaming_card(self.assistant_text, self.tool_messages, self.phase))
            await self._flush_content(False)
        except Exception:
            self._mark_unavailable("assistant update")

    async def add_tool(self, content: str) -> None:
        if not content:
            return
        merge_tool_message(self.tool_messages, content)
        if not self.streaming_ready:
            return
        try:
            self.phase = "tool"
            await self._update_card(build_streaming_card(self.assistant_text, self.tool_messages, self.phase))
        except Exception:
            self._mark_unavailable("tool update")

    async def finish(self, is_error: bool = False) -> None:
        elapsed_ms = int((time.monotonic() - self.started_at) * 1000)
        self._stop_loading_ticker()
        if is_error and not self.error_text:
            self.error_text = "处理失败"

        if self.streaming_ready:
            try:
                if self.assistant_text:
                    await self._flush_content(True)
                await self._update_card(
                    build_final_answer_card(
                        self.assistant_text,
                        self.tool_messages,
                        elapsed_ms,
                        self.error_text,
                    )
                )
                await self.client.finish_streaming_card(
                    self.card_id,
                    build_summary(self.assistant_text, self.tool_messages, self.error_text),
                    self._next_sequence(),
                )
                return
            except Exception:
                self._mark_unavailable("finish")

        await self._send_static_fallback(elapsed_ms)

    async def _send_static_fallback(self, elapsed_ms: int) -> None:
        text = self.error_text or self.assistant_text or "已完成"
        if self.tool_messages:
            text = "\n".join([*self.tool_messages, text])
        text = f"{text}\n\n耗时 {elapsed_ms / 1000:.1f}s"
        await self.client.send_text(self.target, text)

    async def _flush_content(self, force: bool) -> None:
        now = time.monotonic()
        pending_chars = len(self.assistant_text) - self._last_flushed_length
        if not force and (now - self._last_flush_at) * 1000 < self.flush_interval_ms and pending_chars < 80:
            return
        self._last_flush_at = now
        self._last_flushed_length = len(self.assistant_text)
        sequence = self._next_sequence()
        await self._enqueue_update(
            lambda: self.client.update_card_element_content(
                self.card_id,
                FEISHU_STREAM_CONTENT_ELEMENT_ID,
                self.assistant_text,
                sequence,
            )
        )

    async def _update_card(self, card: dict) -> None:
        sequence = self._next_sequence()
        await self._enqueue_update(lambda: self.client.update_card_instance(self.card_id, card, sequence))

    async def _enqueue_update(self, task: Callable[[], Awaitable[None]]) -> None:
        async with self._update_lock:
            try:
                await task()
            except Exception:
                # Feishu cardkit can briefly fail right after card creation because card_id
                # propagation is not visible to every backend service yet.
                await asyncio.sleep(0.8)
                await task()

    def _next_sequence(self) -> int:
        self.sequence += 1
        return self.sequence

    def _start_loading_ticker(self) -> None:
        if self._loading_task is None:
            self._loading_task = asyncio.create_task(self._loading_loop())

    def _stop_loading_ticker(self) -> None:
        if self._loading_task is not None:
            self._loading_task.cancel()
            self._loading_task = None

    async def _loading_loop(self) -> None:
        while True:
            await asyncio.sleep(0.55)
            if not self.streaming_ready:
                return
            self.loading_tick = (self.loading_tick % 3) + 1
            try:
                sequence = self._next_sequence()
                await self._enqueue_update(
                    lambda: self.client.update_card_element_content(
                        self.card_id,
                        FEISHU_LOADING_ELEMENT_ID,
                        build_loading_content(self.phase, "." * self.loading_tick),
                        sequence,
                    )
                )
            except Exception:
                self._mark_unavailable("loading update")
                return

    def _mark_unavailable(self, operation: str) -> None:
        self.streaming_ready = False
        self._stop_loading_ticker()
        logger.warning("feishu streaming card %s failed, fallback to static text", operation, exc_info=True)


def build_streaming_card(
    assistant_text: str,
    tool_messages: list[str],
    phase: FeishuStreamingPhase,
    dots: str = "...",
) -> dict:
    elements: list[dict] = []
    if tool_messages:
        elements.append(build_tool_panel(tool_messages, expanded=True))
    elements.append(
        {
            "tag": "markdown",
            "content": normalize_card_markdown(assistant_text),
            "text_align": "left",
            "text_size": "normal_v2",
            "margin": "0px 0px 0px 0px",
            "element_id": FEISHU_STREAM_CONTENT_ELEMENT_ID,
        }
    )
    elements.append(
        {
            "tag": "markdown",
            "content": build_loading_content(phase, dots),
            "text_size": "notation",
            "element_id": FEISHU_LOADING_ELEMENT_ID,
        }
    )
    summary = loading_text(phase)
    return {
        "schema": "2.0",
        "config": {
            "streaming_mode": True,
            "locales": ["zh_cn", "en_us"],
            "summary": {"content": summary, "i18n_content": {"zh_cn": summary, "en_us": "Processing"}},
        },
        "body": {"elements": elements},
    }


def build_final_answer_card(
    assistant_text: str,
    tool_messages: list[str],
    elapsed_ms: int,
    error_text: str | None = None,
) -> dict:
    text = normalize_card_markdown(f"抱歉，处理消息时遇到错误：{error_text}" if error_text else assistant_text)
    elements: list[dict] = []
    if tool_messages:
        elements.append(build_tool_panel(tool_messages))
    elements.append({"tag": "markdown", "content": text or " ", "text_align": "left", "text_size": "normal_v2"})
    elements.append(
        {
            "tag": "markdown",
            "content": f"<font color='grey'>耗时 {elapsed_ms / 1000:.1f}s</font>",
            "text_size": "notation",
        }
    )
    summary = build_summary(text, tool_messages, error_text)
    return {
        "schema": "2.0",
        "config": {
            "streaming_mode": False,
            "locales": ["zh_cn", "en_us"],
            "summary": {"content": summary, "i18n_content": {"zh_cn": summary, "en_us": summary}},
        },
        "body": {"elements": elements},
    }


def build_loading_content(phase: FeishuStreamingPhase, dots: str) -> str:
    return f"<font color='grey'>{loading_text(phase)}{dots}</font>"


def loading_text(phase: FeishuStreamingPhase) -> str:
    if phase == "tool":
        return "工具执行中"
    if phase == "answering":
        return "输出中"
    return "思考中"


def build_tool_panel(tool_messages: list[str], expanded: bool = False) -> dict:
    title = f"工具执行 · {len(tool_messages)} 步"
    return {
        "tag": "collapsible_panel",
        "expanded": expanded,
        "header": {
            "title": {
                "tag": "plain_text",
                "content": title,
                "i18n_content": {"zh_cn": title, "en_us": f"Tool use · {len(tool_messages)} steps"},
                "text_color": "grey",
                "text_size": "notation",
            },
            "vertical_align": "center",
            "icon": {"tag": "standard_icon", "token": "down-small-ccm_outlined", "color": "grey", "size": "16px 16px"},
            "icon_position": "right",
            "icon_expanded_angle": -180,
        },
        "border": {"color": "grey", "corner_radius": "5px"},
        "vertical_spacing": "4px",
        "padding": "8px 8px 8px 8px",
        "elements": [build_tool_step(message) for message in tool_messages[-20:]],
    }


def build_tool_step(message: str) -> dict:
    lines = normalize_card_markdown(message).split("\n")
    title = normalize_inline(lines[0] if lines else "工具调用")
    detail = normalize_inline("\n".join(lines[1:]).strip())
    content = f"**{title}**\n<font color='grey'>{detail}</font>" if detail else f"**{title}**"
    return {"tag": "markdown", "content": content, "text_size": "notation", "margin": "0px 0px 0px 0px"}


def build_summary(text: str, tool_messages: list[str], error_text: str | None = None) -> str:
    if error_text:
        return "出错"
    preview = text.strip().replace("\n", " ")[:50]
    if preview:
        return f"{preview}..." if len(text.strip()) > 50 else preview
    if tool_messages:
        return f"工具执行 · {len(tool_messages)} 步"
    return "已完成"


def normalize_card_markdown(text: str) -> str:
    return text.replace("<", "&lt;").replace(">", "&gt;")


def normalize_inline(text: str) -> str:
    return " ".join(normalize_card_markdown(text).split())[:300]


def merge_tool_message(messages: list[str], message: str) -> None:
    if message in messages:
        return
    messages.append(message)
