import asyncio
import sqlite3
from pathlib import Path
from typing import Any


class SQLite:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._conn: sqlite3.Connection | None = None
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path)
        self._conn.row_factory = sqlite3.Row
        await self.executescript(
            (Path(__file__).parent / "migrations" / "001_initial.sql").read_text(encoding="utf-8")
        )

    async def execute(
        self, sql: str, parameters: tuple[Any, ...] = ()
    ) -> sqlite3.Cursor:
        if self._conn is None:
            raise RuntimeError("SQLite connection is not initialized")
        async with self._lock:
            cursor = self._conn.execute(sql, parameters)
            self._conn.commit()
            return cursor

    async def fetchone(self, sql: str, parameters: tuple[Any, ...] = ()) -> sqlite3.Row | None:
        cursor = await self.execute(sql, parameters)
        return cursor.fetchone()

    async def fetchall(self, sql: str, parameters: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
        cursor = await self.execute(sql, parameters)
        return list(cursor.fetchall())

    async def executescript(self, sql: str) -> None:
        if self._conn is None:
            raise RuntimeError("SQLite connection is not initialized")
        async with self._lock:
            self._conn.executescript(sql)
            self._conn.commit()

    async def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

