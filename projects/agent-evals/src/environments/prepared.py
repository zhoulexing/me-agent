"""Lease identities for pre-provisioned test environments."""

from config import digest
from models import TargetConfig


def lease_key(config: TargetConfig, lease_index: int) -> str | None:
    if config.kind == "yba":
        return digest([config.base_url, config.sessions[lease_index].session_key])
    return None
