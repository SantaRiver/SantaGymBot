from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.gymtracker_backup import BackupImportData, parse_backup_file, summarize_backup
from app.infrastructure.database.models import Exercise, User, Workout, WorkoutExercise, WorkoutSet


class BackupImportError(RuntimeError):
    pass


@dataclass(frozen=True)
class ImportExecutionSummary:
    user_id: UUID | None
    username: str
    exercise_count: int
    workout_count: int
    workout_exercise_count: int
    workout_set_count: int
    skipped_calendar_days_without_training: int
    skipped_sets_with_nonpositive_reps: int
    reused_system_exercise_count: int
    created_private_exercise_count: int
    deleted_workout_count: int
    deleted_private_exercise_count: int
    dry_run: bool


class BackupImportService:
    async def import_backup(
        self,
        session: AsyncSession,
        *,
        backup_file: str | Path,
        username: str,
        replace_existing: bool,
        dry_run: bool,
    ) -> ImportExecutionSummary:
        backup = parse_backup_file(backup_file)
        summary = summarize_backup(backup)

        user = await self._get_target_user(session, username=username)
        deleted_workout_count = 0
        deleted_private_exercise_count = 0

        if dry_run:
            reused_system_exercise_count, created_private_exercise_count = await self._count_exercise_resolution(
                session, user_id=user.id, backup=backup
            )
            return ImportExecutionSummary(
                user_id=user.id,
                username=username,
                reused_system_exercise_count=reused_system_exercise_count,
                created_private_exercise_count=created_private_exercise_count,
                deleted_workout_count=0,
                deleted_private_exercise_count=0,
                dry_run=True,
                **summary,
            )

        try:
            if replace_existing:
                deleted_workout_count, deleted_private_exercise_count = await self._clear_user_data(session, user_id=user.id)

            reused_system_exercise_count, created_private_exercise_count = await self._import_entities(
                session,
                user=user,
                backup=backup,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise

        return ImportExecutionSummary(
            user_id=user.id,
            username=username,
            reused_system_exercise_count=reused_system_exercise_count,
            created_private_exercise_count=created_private_exercise_count,
            deleted_workout_count=deleted_workout_count,
            deleted_private_exercise_count=deleted_private_exercise_count,
            dry_run=False,
            **summary,
        )

    async def _get_target_user(self, session: AsyncSession, *, username: str) -> User:
        result = await session.execute(select(User).where(User.username == username))
        users = list(result.scalars().all())
        if len(users) != 1:
            raise BackupImportError(
                f"Expected exactly one user with username={username!r}, found {len(users)}"
            )
        return users[0]

    async def _count_exercise_resolution(
        self, session: AsyncSession, *, user_id: UUID, backup: BackupImportData
    ) -> tuple[int, int]:
        system_exercises = await self._load_system_exercises(session)
        reused = 0
        created = 0
        for source_exercise in backup.exercises:
            if source_exercise.normalized_name in system_exercises:
                reused += 1
            else:
                created += 1
        return reused, created

    async def _load_system_exercises(self, session: AsyncSession) -> dict[str, Exercise]:
        result = await session.execute(select(Exercise).where(Exercise.visibility == "system"))
        return {exercise.name_normalized: exercise for exercise in result.scalars().all()}

    async def _clear_user_data(self, session: AsyncSession, *, user_id: UUID) -> tuple[int, int]:
        workout_count = await session.scalar(select(func.count()).select_from(Workout).where(Workout.user_id == user_id))
        private_exercise_count = await session.scalar(
            select(func.count())
            .select_from(Exercise)
            .where(Exercise.user_id == user_id, Exercise.visibility == "private")
        )

        await session.execute(delete(Workout).where(Workout.user_id == user_id))
        await session.execute(delete(Exercise).where(Exercise.user_id == user_id, Exercise.visibility == "private"))
        return int(workout_count or 0), int(private_exercise_count or 0)

    async def _import_entities(
        self, session: AsyncSession, *, user: User, backup: BackupImportData
    ) -> tuple[int, int]:
        system_exercises = await self._load_system_exercises(session)
        exercise_mapping: dict[str, Exercise] = {}
        reused = 0
        created = 0

        for source_exercise in backup.exercises:
            matched = system_exercises.get(source_exercise.normalized_name)
            if matched is not None:
                exercise_mapping[source_exercise.source_id] = matched
                reused += 1
                continue

            private_exercise = Exercise(
                user_id=user.id,
                name=source_exercise.name,
                name_normalized=source_exercise.normalized_name,
                target_muscle_group=source_exercise.target_muscle_group,
                visibility="private",
            )
            session.add(private_exercise)
            await session.flush()
            exercise_mapping[source_exercise.source_id] = private_exercise
            created += 1

        for source_workout in backup.workouts:
            workout = Workout(
                user_id=user.id,
                name=source_workout.name,
                start_time=source_workout.start_time,
                end_time=None,
                status="completed",
                notes=source_workout.notes,
            )
            session.add(workout)
            await session.flush()

            for source_workout_exercise in source_workout.exercises:
                workout_exercise = WorkoutExercise(
                    workout_id=workout.id,
                    exercise_id=exercise_mapping[source_workout_exercise.source_exercise_id].id,
                    order=source_workout_exercise.order,
                )
                session.add(workout_exercise)
                await session.flush()

                for source_set in source_workout_exercise.sets:
                    session.add(
                        WorkoutSet(
                            workout_exercise_id=workout_exercise.id,
                            reps=source_set.reps,
                            weight=source_set.weight,
                            duration_seconds=None,
                            rest_time_after_seconds=None,
                        )
                    )

        return reused, created


backup_import_service = BackupImportService()
