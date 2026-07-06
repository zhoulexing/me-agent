from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.agent.client import AgentClientPool
from app.agent.session import AgentSession
from app.agent.session_store import SessionStore
from app.channels.feishu.client import FeishuClient
from app.channels.feishu.runtime import FeishuRuntime
from app.config import get_settings
from app.gateway.routes import router as gateway_router
from app.sqlite.connection import SQLite


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    sqlite = SQLite(settings.db_path)
    await sqlite.initialize()

    session_store = SessionStore(sqlite)
    client_pool = AgentClientPool(settings)
    agent_session = AgentSession(client_pool=client_pool, session_store=session_store)
    feishu_client = FeishuClient(settings)
    feishu_runtime = FeishuRuntime(settings, feishu_client, agent_session)
    await feishu_runtime.start()

    app.state.sqlite = sqlite
    app.state.agent_session = agent_session
    app.state.feishu_runtime = feishu_runtime
    try:
        yield
    finally:
        await feishu_runtime.stop()
        await client_pool.close()
        await sqlite.close()


def create_app() -> FastAPI:
    app = FastAPI(title="cc-agent", version="0.1.0", lifespan=lifespan)
    app.include_router(gateway_router)
    return app
