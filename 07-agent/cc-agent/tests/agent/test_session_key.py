import pytest

from app.agent.session_key import build_session_key, parse_session_key


def test_session_key_round_trip() -> None:
    key = build_session_key("feishu", "app/1", "group 1")

    parsed = parse_session_key(key)

    assert parsed.channel_id == "feishu"
    assert parsed.app_id == "app/1"
    assert parsed.group_id == "group 1"


def test_parse_session_key_rejects_invalid_shape() -> None:
    with pytest.raises(ValueError):
        parse_session_key("feishu/app")
