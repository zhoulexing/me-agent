from app.sqlite.connection import SQLite
from app.sqlite.repositories.messages import MessageRepository
from app.sqlite.repositories.runs import RunRepository
from app.sqlite.repositories.sessions import SessionRepository


class SessionStore:
    def __init__(self, sqlite: SQLite) -> None:
        self.sessions = SessionRepository(sqlite)
        self.messages = MessageRepository(sqlite)
        self.runs = RunRepository(sqlite)
