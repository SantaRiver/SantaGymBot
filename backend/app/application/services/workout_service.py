from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.domain.schemas.workout import (
    WorkoutCreate, WorkoutUpdate, WorkoutExerciseCreate, WorkoutSetCreate
)
from app.infrastructure.database.repositories.workout import (
    workout_repo, exercise_repo, workout_exercise_repo, workout_set_repo
)
from app.infrastructure.database.models import Workout, WorkoutExercise, WorkoutSet


class WorkoutService:
    @staticmethod
    async def get_workouts(session: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100) -> List[Workout]:
        return await workout_repo.get_user_workouts(session, user_id, skip, limit)

    @staticmethod
    async def get_workout_details(session: AsyncSession, user_id: UUID, workout_id: UUID) -> Workout:
        workout = await workout_repo.get_workout_with_details(session, workout_id)
        if not workout or workout.user_id != user_id:
            raise HTTPException(status_code=404, detail="Workout not found")
        return workout

    @staticmethod
    async def create_workout(session: AsyncSession, user_id: UUID, data: WorkoutCreate) -> Workout:
        workout = await workout_repo.create(session, obj_in={**data.model_dump(), "user_id": user_id})
        return workout

    @staticmethod
    async def update_workout(session: AsyncSession, user_id: UUID, workout_id: UUID, data: WorkoutUpdate) -> Workout:
        workout = await WorkoutService.get_workout_details(session, user_id, workout_id)
        return await workout_repo.update(session, db_obj=workout, obj_in=data.model_dump(exclude_unset=True))

    @staticmethod
    async def add_exercise_to_workout(session: AsyncSession, user_id: UUID, workout_id: UUID, data: WorkoutExerciseCreate) -> WorkoutExercise:
        await WorkoutService.get_workout_details(session, user_id, workout_id)

        exercise = await exercise_repo.get(session, id=data.exercise_id)
        if not exercise or (exercise.user_id and exercise.user_id != user_id):
            raise HTTPException(status_code=400, detail="Exercise not available")

        workout_exercise = await workout_exercise_repo.create(session, obj_in={**data.model_dump(), "workout_id": workout_id})

        # Re-fetch с eager loading, иначе FastAPI упадёт на сериализации relationships
        return await workout_exercise_repo.get_with_details(session, workout_exercise.id)

    @staticmethod
    async def add_set_to_exercise(session: AsyncSession, user_id: UUID, workout_exercise_id: UUID, data: WorkoutSetCreate) -> WorkoutSet:
        # Проверяем, что workout_exercise существует и тренировка принадлежит юзеру
        workout_ex = await workout_exercise_repo.get(session, id=workout_exercise_id)
        if not workout_ex:
            raise HTTPException(status_code=404, detail="Workout Exercise not found")

        await WorkoutService.get_workout_details(session, user_id, workout_ex.workout_id)

        workout_set = await workout_set_repo.create(session, obj_in=data.model_dump())
        return workout_set

workout_service = WorkoutService()
