import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import TypeVar


T = TypeVar("T")


class SessionQueue:
    """Serialize messages per session_key while allowing different sessions to run concurrently."""

    def __init__(self) -> None:
        self._locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def run(self, session_key: str, task: Callable[[], Awaitable[T]]) -> T:
        async with self._locks[session_key]:
            return await task()

