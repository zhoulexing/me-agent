"""Lease identities for pre-provisioned test environments."""

from config import digest
from models import TargetConfig


def lease_key(config: TargetConfig, lease_index: int) -> str | None:
    if config.kind == "yba":
        # The same Pod/session remains one resource through admin and service gateways.
        return digest([config.pod_environment, config.pod_id, config.sessions[lease_index].session_key])
    return None
