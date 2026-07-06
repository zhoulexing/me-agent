import json
from typing import Any

from app.sqlite.connection import SQLite


class MessageRepository:
    def __init__(self, sqlite: SQLite) -> None:
        self._sqlite = sqlite

    async def create(
        self, session_key: str, role: str, content: str, metadata: dict[str, Any]
    ) -> int:
        cursor = await self._sqlite.execute(
            """
            INSERT INTO messages(session_key, role, content, metadata_json)
            VALUES (?, ?, ?, ?)
            """,
            (session_key, role, content, json.dumps(metadata, ensure_ascii=False)),
        )
        return int(cursor.lastrowid)

