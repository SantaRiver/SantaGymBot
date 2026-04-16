from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.infrastructure.database.models import Workout, Exercise, WorkoutExercise, WorkoutSet
from app.infrastructure.database.repositories.base import BaseRepository

class WorkoutRepository(BaseRepository[Workout]):
    def __init__(self):
        super().__init__(Workout)

    async def get_user_workouts(self, session: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100) -> List[Workout]:
        stmt = (
            select(Workout)
            .where(Workout.user_id == user_id)
            .order_by(Workout.created_at.desc())
            .options(
                selectinload(Workout.workout_exercises).selectinload(WorkoutExercise.exercise),
                selectinload(Workout.workout_exercises).selectinload(WorkoutExercise.sets)
            )
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_workout_with_details(self, session: AsyncSession, workout_id: UUID) -> Optional[Workout]:
        stmt = (
            select(Workout)
            .where(Workout.id == workout_id)
            .options(
                selectinload(Workout.workout_exercises).selectinload(WorkoutExercise.exercise),
                selectinload(Workout.workout_exercises).selectinload(WorkoutExercise.sets)
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

class ExerciseRepository(BaseRepository[Exercise]):
    def __init__(self):
        super().__init__(Exercise)

    async def get_all_available_for_user(self, session: AsyncSession, user_id: UUID) -> List[Exercise]:
        """Возвращает системные упражнения (user_id IS NULL) + пользовательские упражнения"""
        stmt = select(Exercise).where((Exercise.user_id == None) | (Exercise.user_id == user_id))
        result = await session.execute(stmt)
        return list(result.scalars().all())

class WorkoutExerciseRepository(BaseRepository[WorkoutExercise]):
    def __init__(self):
        super().__init__(WorkoutExercise)

    async def get_with_details(self, session: AsyncSession, workout_exercise_id: UUID) -> Optional[WorkoutExercise]:
        stmt = (
            select(WorkoutExercise)
            .where(WorkoutExercise.id == workout_exercise_id)
            .options(
                selectinload(WorkoutExercise.exercise),
                selectinload(WorkoutExercise.sets),
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

class WorkoutSetRepository(BaseRepository[WorkoutSet]):
    def __init__(self):
        super().__init__(WorkoutSet)


workout_repo = WorkoutRepository()
exercise_repo = ExerciseRepository()
workout_exercise_repo = WorkoutExerciseRepository()
workout_set_repo = WorkoutSetRepository()
