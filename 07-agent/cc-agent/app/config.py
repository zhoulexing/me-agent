from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_base_url: str = Field(default="https://api.anthropic.com", alias="ANTHROPIC_BASE_URL")
    anthropic_auth_token: str = Field(default="", alias="ANTHROPIC_AUTH_TOKEN")
    anthropic_model: str = Field(default="claude-sonnet-4-5", alias="ANTHROPIC_MODEL")

    host: str = Field(default="127.0.0.1", alias="CC_AGENT_HOST")
    port: int = Field(default=8080, alias="CC_AGENT_PORT")
    db_path: Path = Field(default=Path("runtime/cc-agent.sqlite3"), alias="CC_AGENT_DB_PATH")
    workdir: Path = Field(default=Path("."), alias="CC_AGENT_WORKDIR")
    permission_mode: Literal["default", "acceptEdits", "plan", "bypassPermissions", "dontAsk", "auto"] = (
        Field(default="acceptEdits", alias="CC_AGENT_PERMISSION_MODE")
    )
    max_turns: int = Field(default=120, alias="CC_AGENT_MAX_TURNS")

    feishu_enabled: bool = Field(default=False, alias="FEISHU_ENABLED")
    feishu_app_id: str = Field(default="", alias="FEISHU_APP_ID")
    feishu_app_secret: str = Field(default="", alias="FEISHU_APP_SECRET")
    feishu_verification_token: str = Field(default="", alias="FEISHU_VERIFICATION_TOKEN")
    feishu_encrypt_key: str = Field(default="", alias="FEISHU_ENCRYPT_KEY")
    wechat_app_id: str = Field(default="", alias="WECHAT_APP_ID")
    wechat_app_secret: str = Field(default="", alias="WECHAT_APP_SECRET")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
