from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class BackgroundTaskMessage:
    session_key: str
    task_id: str
    status: str
    payload: dict[str, Any]


class BackgroundWatch:
    """Placeholder for SDK task-notification fanout.

    The persistent client pool keeps one SDK connection per session_key; this
    class is the extension point for listening to background task messages and
    forwarding them through channel run contexts.
    """

    async def handle(self, message: BackgroundTaskMessage) -> None:
        return None
