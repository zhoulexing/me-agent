from fastapi import APIRouter

from app.gateway.routes.agent import router as agent_router
from app.gateway.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router)
router.include_router(agent_router, prefix="/api/agent")

