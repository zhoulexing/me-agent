from dataclasses import dataclass


@dataclass(frozen=True)
class WeChatClient:
    app_id: str
    app_secret: str

    async def send_text(self, conversation_id: str, text: str) -> None:
        return None

