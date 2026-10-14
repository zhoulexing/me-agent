import pytest


@pytest.fixture(autouse=True)
def fake_yba_cookie(monkeypatch):
    # Only MockTransport tests reference this variable; no user credentials are loaded.
    monkeypatch.setenv("YBA_EVAL_TEST_COOKIE", "session=test-cookie")
