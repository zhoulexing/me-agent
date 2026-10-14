"""Remote Pod proxy contracts from yzclaw-helper and ADE; never retry submissions."""

import json
import os
from pathlib import Path
from urllib.parse import quote

import httpx

from adapters.base import TargetError
from models import TargetConfig


def proxy_path(config: TargetConfig, service_path: str) -> str:
    if (
        not service_path.startswith("/api/")
        or any(c in service_path for c in ("\\", "#", "?"))
        or any(c.isspace() for c in service_path)
        or any(part in {".", ".."} for part in service_path.split("/"))
        or "%" in service_path
    ):
        raise TargetError("invalid Pod service path")
    gateway = "/api/agent-pod-proxy" if config.pod_transport == "admin" else ""
    return f"{gateway}/api/v1/agent-pods/{quote(config.pod_id, safe='')}/proxy/8080{service_path}"


def auth_headers(config: TargetConfig) -> tuple[dict[str, str], list[str]]:
    headers = {}
    for header, variable in config.headers_env.items():
        value = os.environ.get(variable, "").strip()
        if not value:
            raise TargetError(f"missing header environment variable: {variable}")
        headers[header.lower()] = value
    if config.cookie_file and "cookie" not in headers:
        try:
            path = Path(config.cookie_file).expanduser()
            if path.stat().st_size > 65536:
                raise TargetError("configured Pod Cookie file exceeds size limit")
            headers["cookie"] = path.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError) as exc:
            raise TargetError("cannot read configured Pod Cookie file") from exc
    if config.pod_transport == "admin":
        if not headers.get("cookie"):
            raise TargetError("admin Pod transport requires Cookie via headers_env or cookie_file")
        headers["referer"] = f"{config.base_url.rstrip('/')}/manage/project/youzan-business-assistant/pods"
    elif not headers.get("authorization", "").startswith("Bearer "):
        raise TargetError("service Pod transport requires a Bearer API key via headers_env")
    headers.setdefault("accept", "application/json, text/plain, */*")
    headers.setdefault("user-agent", "agent-evals/0.1.0")
    secrets = []
    for header, value in headers.items():
        if header in {"referer", "accept", "user-agent"}:
            continue
        secrets.append(value)
        if header == "cookie":
            secrets.extend(part.split("=", 1)[1].strip() for part in value.split(";") if "=" in part)
        if header == "authorization" and value.startswith(("Bearer ", "Basic ")):
            secrets.append(value.split(" ", 1)[1])
    return headers, secrets


class PodTransport:
    def __init__(self, config: TargetConfig, client: httpx.AsyncClient | None = None):
        self.config = config
        self.headers, self.secrets = auth_headers(config)
        self.client = client or httpx.AsyncClient(
            timeout=config.request_timeout_seconds,
            follow_redirects=False,
            trust_env=False,
        )

    async def request(self, method: str, path: str, *, body=None, missing_ok=False):
        url = self.config.base_url.rstrip("/") + proxy_path(self.config, path)
        try:
            async with self.client.stream(
                method,
                url,
                json=body,
                headers=self.headers,
                timeout=self.config.request_timeout_seconds,
                follow_redirects=False,
            ) as response:
                status = response.status_code
                if missing_ok and status == 404:
                    return None
                if status in {401, 403} or 300 <= status < 400:
                    raise TargetError(f"Pod proxy authentication failed (HTTP {status}); request not retried")
                if not 200 <= status < 300:
                    raise TargetError(f"Pod proxy {path}: HTTP {status}")
                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > self.config.max_response_bytes:
                        raise TargetError("Pod proxy response exceeds configured byte budget")
                try:
                    value = json.loads(chunks)
                except (ValueError, UnicodeError) as exc:
                    raise TargetError("Pod proxy response is not valid JSON; check login") from exc
        except httpx.HTTPError as exc:
            raise TargetError(
                f"Pod proxy transport error: {type(exc).__name__}; submission is not retried"
            ) from exc
        # The service proxy preserves the inner YBA success/data envelope.
        if not isinstance(value, dict) or value.get("success") is not True:
            raise TargetError("YBA response envelope is not successful")
        return value.get("data")

    async def close(self):
        await self.client.aclose()
