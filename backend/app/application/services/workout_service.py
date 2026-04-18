from uuid import UUID
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.application.services.workout_stats import build_stats_payload, calculate_period_bounds
from app.domain.schemas.workout import (
    WorkoutCreate,
    WorkoutStatsRead,
    WorkoutUpdate,
    WorkoutExerciseCreate,
    WorkoutExerciseReorderRequest,
    WorkoutSetCreate,
    WorkoutSetUpdate,
)
from app.infrastructure.database.repositories.workout import (
    workout_repo, exercise_repo, workout_exercise_repo, workout_set_repo
)
from app.infrastructure.database.models import Workout, WorkoutExercise, WorkoutSet


class WorkoutService:
    @staticmethod
    def _ensure_workout_is_editable(workout: Workout) -> None:
        if workout.status == "completed":
            raise HTTPException(status_code=400, detail="Completed workouts cannot be edited")

    @staticmethod
    async def get_workouts(session: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 100) -> List[Workout]:
        return await workout_repo.get_user_workouts(session, user_id, skip, limit)

    @staticmethod
    async def get_stats(
        session: AsyncSession,
        *,
        user_id: UUID,
        timezone_name: str,
        period: str,
    ) -> WorkoutStatsRead:
        try:
            start_at, end_at = calculate_period_bounds(period, timezone_name)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        workouts = await workout_repo.get_completed_workouts_in_range(
            session,
            user_id=user_id,
            start_at=start_at,
            end_at=end_at,
        )
        return WorkoutStatsRead(**build_stats_payload(period, timezone_name, workouts))

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
        if data.status == "completed" and len(workout.workout_exercises) == 0:
            raise HTTPException(status_code=400, detail="Cannot complete an empty workout")
        return await workout_repo.update(session, db_obj=workout, obj_in=data.model_dump(exclude_unset=True))

    @staticmethod
    async def add_exercise_to_workout(session: AsyncSession, user_id: UUID, workout_id: UUID, data: WorkoutExerciseCreate) -> WorkoutExercise:
        workout = await WorkoutService.get_workout_details(session, user_id, workout_id)
        WorkoutService._ensure_workout_is_editable(workout)

        exercise = await exercise_repo.get(session, id=data.exercise_id)
        if not exercise or (exercise.user_id and exercise.user_id != user_id):
            raise HTTPException(status_code=400, detail="Exercise not available")

        workout_exercises = await workout_exercise_repo.list_for_workout(session, workout_id)
        next_order = len(workout_exercises) + 1
        workout_exercise = await workout_exercise_repo.create(
            session,
            obj_in={
                **data.model_dump(),
                "workout_id": workout_id,
                "order": next_order,
            },
        )

        # Re-fetch с eager loading, иначе FastAPI упадёт на сериализации relationships
        return await workout_exercise_repo.get_with_details(session, workout_exercise.id)

    @staticmethod
    async def remove_exercise_from_workout(
        session: AsyncSession,
        user_id: UUID,
        workout_id: UUID,
        workout_exercise_id: UUID,
    ) -> None:
        workout = await WorkoutService.get_workout_details(session, user_id, workout_id)
        WorkoutService._ensure_workout_is_editable(workout)

        workout_exercise = await workout_exercise_repo.get_for_workout(
            session,
            workout_id=workout_id,
            workout_exercise_id=workout_exercise_id,
        )
        if not workout_exercise:
            raise HTTPException(status_code=404, detail="Workout exercise not found")

        await session.delete(workout_exercise)
        await session.flush()

        remaining = await workout_exercise_repo.list_for_workout(session, workout_id)
        for index, exercise in enumerate(remaining, start=1):
            exercise.order = index

        await session.commit()

    @staticmethod
    async def reorder_workout_exercises(
        session: AsyncSession,
        user_id: UUID,
        workout_id: UUID,
        data: WorkoutExerciseReorderRequest,
    ) -> None:
        workout = await WorkoutService.get_workout_details(session, user_id, workout_id)
        WorkoutService._ensure_workout_is_editable(workout)

        current_exercises = await workout_exercise_repo.list_for_workout(session, workout_id)
        if len(current_exercises) == 0:
            raise HTTPException(status_code=400, detail="Workout has no exercises to reorder")

        current_ids = {exercise.id for exercise in current_exercises}
        requested_ids = list(data.workout_exercise_ids)

        if len(requested_ids) != len(current_exercises) or set(requested_ids) != current_ids:
            raise HTTPException(status_code=400, detail="Reorder payload must include all workout exercises exactly once")

        exercise_by_id = {exercise.id: exercise for exercise in current_exercises}
        for index, exercise_id in enumerate(requested_ids, start=1):
            exercise_by_id[exercise_id].order = index

        await session.commit()

    @staticmethod
    async def discard_empty_workout(session: AsyncSession, user_id: UUID, workout_id: UUID) -> None:
        workout = await WorkoutService.get_workout_details(session, user_id, workout_id)
        WorkoutService._ensure_workout_is_editable(workout)
        if len(workout.workout_exercises) > 0:
            raise HTTPException(status_code=400, detail="Only empty workouts can be discarded")

        await session.delete(workout)
        await session.commit()

    @staticmethod
    async def add_set_to_exercise(session: AsyncSession, user_id: UUID, workout_exercise_id: UUID, data: WorkoutSetCreate) -> WorkoutSet:
        # Проверяем, что workout_exercise существует и тренировка принадлежит юзеру
        workout_ex = await workout_exercise_repo.get(session, id=workout_exercise_id)
        if not workout_ex:
            raise HTTPException(status_code=404, detail="Workout Exercise not found")

        workout = await WorkoutService.get_workout_details(session, user_id, workout_ex.workout_id)
        WorkoutService._ensure_workout_is_editable(workout)

        workout_set = await workout_set_repo.create(session, obj_in=data.model_dump())
        return workout_set

    @staticmethod
    async def update_set(
        session: AsyncSession,
        user_id: UUID,
        workout_set_id: UUID,
        data: WorkoutSetUpdate,
    ) -> WorkoutSet:
        workout_set = await workout_set_repo.get(session, id=workout_set_id)
        if not workout_set:
            raise HTTPException(status_code=404, detail="Workout set not found")

        workout_ex = await workout_exercise_repo.get(session, id=workout_set.workout_exercise_id)
        if not workout_ex:
            raise HTTPException(status_code=404, detail="Workout Exercise not found")

        workout = await WorkoutService.get_workout_details(session, user_id, workout_ex.workout_id)
        WorkoutService._ensure_workout_is_editable(workout)

        return await workout_set_repo.update(
            session,
            db_obj=workout_set,
            obj_in=data.model_dump(exclude_unset=True),
        )

workout_service = WorkoutService()
