import json
from typing import Any

from app.sqlite.connection import SQLite


class RunRepository:
    def __init__(self, sqlite: SQLite) -> None:
        self._sqlite = sqlite

    async def create(self, session_key: str, metadata: dict[str, Any]) -> int:
        cursor = await self._sqlite.execute(
            """
            INSERT INTO runs(session_key, status, metadata_json)
            VALUES (?, 'running', ?)
            """,
            (session_key, json.dumps(metadata, ensure_ascii=False)),
        )
        return int(cursor.lastrowid)

    async def finish(self, run_id: int, status: str, result: dict[str, Any]) -> None:
        await self._sqlite.execute(
            """
            UPDATE runs
            SET status = ?, result_json = ?, finished_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (status, json.dumps(result, ensure_ascii=False), run_id),
        )

