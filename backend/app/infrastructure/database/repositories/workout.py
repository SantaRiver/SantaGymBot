from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text as sa_text
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

    async def get_completed_workouts_in_range(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        start_at: Optional[datetime] = None,
        end_at: Optional[datetime] = None,
    ) -> List[Workout]:
        effective_time = func.coalesce(Workout.start_time, Workout.created_at)
        stmt = (
            select(Workout)
            .where(
                Workout.user_id == user_id,
                Workout.status == "completed",
            )
            .options(
                selectinload(Workout.workout_exercises).selectinload(WorkoutExercise.exercise),
                selectinload(Workout.workout_exercises).selectinload(WorkoutExercise.sets),
            )
            .order_by(effective_time.desc())
        )

        if start_at is not None:
            stmt = stmt.where(effective_time >= start_at)

        if end_at is not None:
            stmt = stmt.where(effective_time < end_at)

        result = await session.execute(stmt)
        return list(result.scalars().all())

class ExerciseRepository(BaseRepository[Exercise]):
    def __init__(self):
        super().__init__(Exercise)

    async def get_all_available_for_user(self, session: AsyncSession, user_id: UUID) -> List[Exercise]:
        stmt = (
            select(Exercise)
            .where(
                (Exercise.visibility == "system")
                | ((Exercise.visibility == "private") & (Exercise.user_id == user_id))
            )
            .order_by(Exercise.name)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def search_similar(
        self,
        session: AsyncSession,
        name_normalized: str,
        user_id: UUID,
        threshold: float = 0.3,
        limit: int = 5,
    ) -> List[dict]:
        stmt = sa_text(
            """
            SELECT
                id,
                name,
                target_muscle_group,
                visibility,
                similarity(name_normalized, :q) AS score
            FROM exercises
            WHERE
                similarity(name_normalized, :q) >= :threshold
                AND (
                    visibility = 'system'
                    OR (visibility = 'private' AND user_id = :user_id)
                )
            ORDER BY score DESC, name ASC
            LIMIT :limit
            """
        ).bindparams(
            q=name_normalized,
            threshold=threshold,
            user_id=user_id,
            limit=limit,
        )
        result = await session.execute(stmt)
        return [dict(row._mapping) for row in result.fetchall()]

    async def create_custom(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        name: str,
        name_normalized: str,
        target_muscle_group: Optional[str],
    ) -> Exercise:
        exercise = Exercise(
            user_id=user_id,
            name=name,
            name_normalized=name_normalized,
            target_muscle_group=target_muscle_group,
            visibility="private",
        )
        session.add(exercise)
        await session.commit()
        await session.refresh(exercise)
        return exercise

class WorkoutExerciseRepository(BaseRepository[WorkoutExercise]):
    def __init__(self):
        super().__init__(WorkoutExercise)

    async def list_for_workout(self, session: AsyncSession, workout_id: UUID) -> List[WorkoutExercise]:
        stmt = (
            select(WorkoutExercise)
            .where(WorkoutExercise.workout_id == workout_id)
            .order_by(WorkoutExercise.order.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

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

    async def get_for_workout(
        self,
        session: AsyncSession,
        *,
        workout_id: UUID,
        workout_exercise_id: UUID,
    ) -> Optional[WorkoutExercise]:
        stmt = select(WorkoutExercise).where(
            WorkoutExercise.id == workout_exercise_id,
            WorkoutExercise.workout_id == workout_id,
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
