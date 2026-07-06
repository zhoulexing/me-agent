from dataclasses import dataclass
from urllib.parse import quote, unquote


SESSION_KEY_PARTS = 3


@dataclass(frozen=True)
class ParsedSessionKey:
    channel_id: str
    app_id: str
    group_id: str


def build_session_key(channel_id: str, app_id: str, group_id: str) -> str:
    return "/".join(quote(part, safe="") for part in (channel_id, app_id, group_id))


def parse_session_key(session_key: str) -> ParsedSessionKey:
    parts = session_key.split("/")
    if len(parts) != SESSION_KEY_PARTS or any(part == "" for part in parts):
        raise ValueError(f"Invalid session_key: {session_key!r}")
    channel_id, app_id, group_id = (unquote(part) for part in parts)
    return ParsedSessionKey(channel_id=channel_id, app_id=app_id, group_id=group_id)

