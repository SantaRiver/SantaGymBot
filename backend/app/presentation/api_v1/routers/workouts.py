from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.database import get_async_session
from app.infrastructure.database.models import User
from app.presentation.api_v1.deps.deps import get_current_user
from app.application.services.workout_service import workout_service
from app.domain.schemas.workout import (
    WorkoutRead, WorkoutReadWithDetails, WorkoutCreate, WorkoutUpdate,
    WorkoutExerciseCreate, WorkoutExerciseRead, WorkoutExerciseReorderRequest, WorkoutSetCreate, WorkoutSetRead,
    WorkoutSetUpdate
)

router = APIRouter()

@router.get("/", response_model=List[WorkoutReadWithDetails])
async def get_my_workouts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Список тренировок пользователя со всеми загруженными упражнениями и сетами"""
    return await workout_service.get_workouts(session, current_user.id, skip, limit)

@router.post("/", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
async def create_workout(
    data: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Начать или запланировать новую тренировку"""
    return await workout_service.create_workout(session, current_user.id, data)

@router.get("/{workout_id}", response_model=WorkoutReadWithDetails)
async def get_workout_details(
    workout_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Детали конкретной тренировки"""
    return await workout_service.get_workout_details(session, current_user.id, workout_id)

@router.patch("/{workout_id}", response_model=WorkoutRead)
async def update_workout_status(
    workout_id: UUID,
    data: WorkoutUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Обновить тренировку (например, завершить ее - status=completed)"""
    return await workout_service.update_workout(session, current_user.id, workout_id, data)

@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def discard_empty_workout(
    workout_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Удалить пустую незавершённую тренировку"""
    await workout_service.discard_empty_workout(session, current_user.id, workout_id)

@router.post("/{workout_id}/exercises", response_model=WorkoutExerciseRead, status_code=status.HTTP_201_CREATED)
async def add_exercise_to_workout(
    workout_id: UUID,
    data: WorkoutExerciseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Добавить упражнение в план тренировки"""
    return await workout_service.add_exercise_to_workout(session, current_user.id, workout_id, data)

@router.delete("/{workout_id}/exercises/{workout_exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_exercise_from_workout(
    workout_id: UUID,
    workout_exercise_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Удалить упражнение из активной тренировки"""
    await workout_service.remove_exercise_from_workout(session, current_user.id, workout_id, workout_exercise_id)

@router.patch("/{workout_id}/exercises/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_workout_exercises(
    workout_id: UUID,
    data: WorkoutExerciseReorderRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Сохранить новый порядок упражнений в активной тренировке"""
    await workout_service.reorder_workout_exercises(session, current_user.id, workout_id, data)

@router.post("/exercises/{workout_exercise_id}/sets", response_model=WorkoutSetRead, status_code=status.HTTP_201_CREATED)
async def log_workout_set(
    workout_exercise_id: UUID,
    data: WorkoutSetCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Залогировать подход (reps, weight, time) для конкретного упражнения в тренировке"""
    # Force injection for safety
    data.workout_exercise_id = workout_exercise_id
    return await workout_service.add_set_to_exercise(session, current_user.id, workout_exercise_id, data)

@router.patch("/sets/{workout_set_id}", response_model=WorkoutSetRead)
async def update_workout_set(
    workout_set_id: UUID,
    data: WorkoutSetUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Обновить существующий подход"""
    return await workout_service.update_set(session, current_user.id, workout_set_id, data)
