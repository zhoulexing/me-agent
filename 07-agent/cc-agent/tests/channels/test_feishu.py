from dataclasses import dataclass

from app.channels.feishu.client import FeishuReceivedMessage, FeishuSendTarget, extract_text_content
from app.channels.feishu.inbound import FeishuInbound
from app.channels.feishu.streaming_card import FeishuStreamingCard
from app.config import Settings


def test_extract_text_content_from_feishu_json() -> None:
    assert extract_text_content('{"text":"hello"}') == "hello"


async def test_feishu_inbound_builds_agent_params() -> None:
    captured = {}
    settings = Settings(FEISHU_ENABLED=True, FEISHU_APP_ID="app", FEISHU_APP_SECRET="secret")
    client = _FakeFeishuClient(settings)
    agent = _FakeAgentSession(captured)
    inbound = FeishuInbound(client, agent)  # type: ignore[arg-type]

    result = await inbound.handle_message(
        FeishuReceivedMessage(
            event_id="event-1",
            message_id="msg-1",
            chat_id="chat-1",
            chat_type="group",
            sender_id="open-1",
            sender_name="User",
            thread_id="thread-1",
            text="hello",
            raw={},
        )
    )

    params = captured["params"]
    assert result == {"status": "ok"}
    assert params.app_id == "app"
    assert params.group_id == "chat-1"
    assert params.reply_to == "msg-1"
    assert params.content == "hello"
    assert params.is_private is False


async def test_streaming_card_retries_transient_update_failure() -> None:
    settings = Settings(FEISHU_ENABLED=True, FEISHU_APP_ID="app", FEISHU_APP_SECRET="secret")
    client = _FakeFeishuClient(settings)
    client.fail_next_update = True
    card = FeishuStreamingCard(client, FeishuSendTarget(receive_id_type="chat_id", receive_id="chat-1"))  # type: ignore[arg-type]

    await card.start()
    card._stop_loading_ticker()
    await card.add_assistant("hello")

    assert client.update_element_calls == 2
    assert card.streaming_ready is True


@dataclass
class _FakeFeishuClient:
    settings: Settings
    fail_next_update: bool = False
    update_element_calls: int = 0

    @property
    def app_id(self) -> str:
        return self.settings.feishu_app_id

    async def send_text(self, target, text: str) -> None:
        return None

    async def add_reaction(self, message_id: str | None, emoji_type: str) -> str | None:
        return "reaction-1"

    async def delete_reaction(self, message_id: str | None, reaction_id: str | None) -> None:
        return None

    async def create_card_instance(self, card: dict) -> str:
        return "card-1"

    async def send_card_reference(self, target, card_id: str) -> None:
        return None

    async def update_card_instance(self, card_id: str, card: dict, sequence: int) -> None:
        return None

    async def update_card_element_content(
        self,
        card_id: str,
        element_id: str,
        content: str,
        sequence: int,
    ) -> None:
        self.update_element_calls += 1
        if self.fail_next_update:
            self.fail_next_update = False
            raise RuntimeError("card_id not synced")
        return None

    async def finish_streaming_card(self, card_id: str, summary: str, sequence: int) -> None:
        return None


class _FakeAgentSession:
    def __init__(self, captured: dict) -> None:
        self._captured = captured

    async def run(self, params, context) -> dict:
        self._captured["params"] = params
        self._captured["context"] = context
        return {"status": "ok"}
