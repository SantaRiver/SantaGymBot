from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title="SantaGym WebApp API",
    version="0.1.0",
    description="Backend API for Telegram WebApp Gym Tracker"
)

# CORS Setup: Очень важно для Telegram WebApp при разработке
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: В проде указать конкретные домены, где хостится фронт
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
async def health_check():
    """Эндпоинт для docker healthcheck и Traefik"""
    return {"status": "ok", "environment": "production" if not settings.DEBUG else "development"}

# Роутеры
from app.presentation.api_v1.routers.auth import router as auth_router
from app.presentation.api_v1.routers.workouts import router as workouts_router

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(workouts_router, prefix="/api/v1/workouts", tags=["Workouts"])
