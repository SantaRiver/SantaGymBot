from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.exercise_service import exercise_service
from app.domain.schemas.exercise import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseSimilarResponse,
)
from app.infrastructure.database.database import get_async_session
from app.infrastructure.database.models import User
from app.presentation.api_v1.deps.deps import get_current_user

router = APIRouter()


@router.get("/similar", response_model=ExerciseSimilarResponse)
async def get_similar_exercises(
    name: str = Query(..., min_length=1, max_length=255),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await exercise_service.find_similar(
        session,
        name=name,
        user_id=current_user.id,
    )


@router.get("/", response_model=List[ExerciseRead])
async def get_exercises(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return system exercises + user's custom exercises."""
    return await exercise_service.get_available_for_user(session, current_user.id)


@router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    payload: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await exercise_service.create_custom_exercise(
        session,
        payload=payload,
        user_id=current_user.id,
    )


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_exercises(
    session: AsyncSession = Depends(get_async_session),
):
    """Idempotent seed of system exercises. Safe to call multiple times."""
    inserted = await exercise_service.seed_system_exercises(session)
    return {"inserted": inserted, "message": f"Seeded {inserted} new exercises"}
