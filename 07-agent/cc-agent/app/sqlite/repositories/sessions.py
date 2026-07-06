from app.sqlite.connection import SQLite


class SessionRepository:
    def __init__(self, sqlite: SQLite) -> None:
        self._sqlite = sqlite

    async def upsert(self, session_key: str) -> None:
        await self._sqlite.execute(
            """
            INSERT INTO sessions(session_key) VALUES (?)
            ON CONFLICT(session_key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            """,
            (session_key,),
        )

