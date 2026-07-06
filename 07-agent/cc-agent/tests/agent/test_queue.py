import asyncio

from app.agent.queue import SessionQueue


async def test_queue_serializes_same_session_key() -> None:
    queue = SessionQueue()
    events: list[str] = []

    async def task(name: str) -> str:
        events.append(f"{name}:start")
        await asyncio.sleep(0.01)
        events.append(f"{name}:end")
        return name

    results = await asyncio.gather(
        queue.run("same", lambda: task("a")),
        queue.run("same", lambda: task("b")),
    )

    assert results == ["a", "b"]
    assert events == ["a:start", "a:end", "b:start", "b:end"]

