import inspect
from typing import Any


async def emit(callback, event: Any) -> None:
    if callback is None:
        return
    result = callback(event)
    if inspect.isawaitable(result):
        await result

