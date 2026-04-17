from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any
from uuid import UUID

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.infrastructure.database.models import Exercise, User


REQUIRED_TOP_LEVEL_KEYS = {
    "exerciseSetApproaches",
    "exerciseSupersets",
    "exercises",
    "exerciseSets",
    "trainings",
    "calendarDays",
    "programs",
    "backupDate",
}

CATEGORY_TO_MUSCLE_GROUP = {
    "chestCategory": "Грудь",
    "backCategory": "Спина",
    "legsCategory": "Ноги",
    "armsCategory": "Руки",
    "shouldersCategory": "Плечи",
    "abdominalsCategory": "Пресс",
    "cardioCategory": "Кардио",
    "stretchingCategory": "Растяжка",
}


class BackupValidationError(ValueError):
    pass


class BackupImportError(RuntimeError):
    pass


@dataclass(frozen=True)
class SourceExercise:
    source_id: str
    name: str
    category_id: str
    target_muscle_group: str | None
    normalized_name: str


@dataclass(frozen=True)
class SourceWorkoutSet:
    source_id: str
    reps: int
    weight: float | None


@dataclass(frozen=True)
class SourceWorkoutExercise:
    source_id: str
    source_exercise_id: str
    order: int
    sets: tuple[SourceWorkoutSet, ...]


@dataclass(frozen=True)
class SourceWorkout:
    source_calendar_day_id: str
    source_training_id: str
    start_time: datetime
    name: str | None
    notes: str | None
    exercises: tuple[SourceWorkoutExercise, ...]


@dataclass(frozen=True)
class BackupImportData:
    exercises: tuple[SourceExercise, ...]
    workouts: tuple[SourceWorkout, ...]
    skipped_calendar_days_without_training: int
    skipped_sets_with_nonpositive_reps: int


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


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).lower()


def parse_backup_file(path: str | Path) -> BackupImportData:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return parse_backup_payload(payload)


def parse_backup_payload(payload: dict[str, Any]) -> BackupImportData:
    _validate_top_level(payload)

    exercises = {
        item["id"]: SourceExercise(
            source_id=item["id"],
            name=item["name"],
            category_id=item["categoryId"],
            target_muscle_group=CATEGORY_TO_MUSCLE_GROUP.get(item["categoryId"]),
            normalized_name=normalize_name(item["name"]),
        )
        for item in payload["exercises"]
    }
    approaches = {item["id"]: item for item in payload["exerciseSetApproaches"]}
    exercise_sets = {item["id"]: item for item in payload["exerciseSets"]}
    trainings = {item["id"]: item for item in payload["trainings"]}

    skipped_calendar_days_without_training = 0
    skipped_sets_with_nonpositive_reps = 0
    workouts: list[SourceWorkout] = []

    for calendar_day in payload["calendarDays"]:
        training_id = calendar_day.get("trainingId")
        if not training_id:
            skipped_calendar_days_without_training += 1
            continue

        training = trainings.get(training_id)
        if training is None:
            raise BackupValidationError(f"calendarDay references unknown trainingId={training_id}")

        workout_exercises: list[SourceWorkoutExercise] = []
        for order, exercise_set_id in enumerate(training.get("exerciseSetIds", []), start=1):
            exercise_set = exercise_sets.get(exercise_set_id)
            if exercise_set is None:
                raise BackupValidationError(f"training references unknown exerciseSetId={exercise_set_id}")

            exercise_id = exercise_set["exerciseId"]
            if exercise_id not in exercises:
                raise BackupValidationError(f"exerciseSet references unknown exerciseId={exercise_id}")

            imported_sets: list[SourceWorkoutSet] = []
            for approach_id in exercise_set.get("approachIds", []):
                approach = approaches.get(approach_id)
                if approach is None:
                    raise BackupValidationError(f"exerciseSet references unknown approachId={approach_id}")

                reps = int(approach.get("repeats", 0))
                if reps <= 0:
                    skipped_sets_with_nonpositive_reps += 1
                    continue

                weight_raw = approach.get("weight")
                weight = float(weight_raw) if weight_raw is not None else None
                imported_sets.append(
                    SourceWorkoutSet(
                        source_id=approach_id,
                        reps=reps,
                        weight=weight,
                    )
                )

            workout_exercises.append(
                SourceWorkoutExercise(
                    source_id=exercise_set_id,
                    source_exercise_id=exercise_id,
                    order=order,
                    sets=tuple(imported_sets),
                )
            )

        workouts.append(
            SourceWorkout(
                source_calendar_day_id=calendar_day["id"],
                source_training_id=training_id,
                start_time=_parse_utc_naive(calendar_day["date"]),
                name=training.get("name") or None,
                notes=_build_workout_notes(calendar_day=calendar_day, training=training),
                exercises=tuple(workout_exercises),
            )
        )

    return BackupImportData(
        exercises=tuple(exercises.values()),
        workouts=tuple(workouts),
        skipped_calendar_days_without_training=skipped_calendar_days_without_training,
        skipped_sets_with_nonpositive_reps=skipped_sets_with_nonpositive_reps,
    )


def summarize_backup(data: BackupImportData) -> dict[str, int]:
    return {
        "exercise_count": len(data.exercises),
        "workout_count": len(data.workouts),
        "workout_exercise_count": sum(len(workout.exercises) for workout in data.workouts),
        "workout_set_count": sum(len(exercise.sets) for workout in data.workouts for exercise in workout.exercises),
        "skipped_calendar_days_without_training": data.skipped_calendar_days_without_training,
        "skipped_sets_with_nonpositive_reps": data.skipped_sets_with_nonpositive_reps,
    }


async def import_backup(
    session: AsyncSession,
    *,
    backup_file: str | Path,
    username: str,
    replace_existing: bool,
    dry_run: bool,
) -> ImportExecutionSummary:
    backup = parse_backup_file(backup_file)
    summary = summarize_backup(backup)

    user = await _get_target_user(session, username=username)
    deleted_workout_count = 0
    deleted_private_exercise_count = 0

    if dry_run:
        reused_system_exercise_count, created_private_exercise_count = await _count_exercise_resolution(
            session, backup=backup
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
            deleted_workout_count, deleted_private_exercise_count = await _clear_user_data(session, user_id=user.id)

        reused_system_exercise_count, created_private_exercise_count = await _import_entities(
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


async def _get_target_user(session: AsyncSession, *, username: str) -> User:
    from sqlalchemy import select
    from app.infrastructure.database.models import User

    result = await session.execute(select(User).where(User.username == username))
    users = list(result.scalars().all())
    if len(users) != 1:
        raise BackupImportError(f"Expected exactly one user with username={username!r}, found {len(users)}")
    return users[0]


async def _count_exercise_resolution(session: AsyncSession, *, backup: BackupImportData) -> tuple[int, int]:
    system_exercises = await _load_system_exercises(session)
    reused = 0
    created = 0
    for source_exercise in backup.exercises:
        if source_exercise.normalized_name in system_exercises:
            reused += 1
        else:
            created += 1
    return reused, created


async def _load_system_exercises(session: AsyncSession) -> dict[str, Exercise]:
    from sqlalchemy import select
    from app.infrastructure.database.models import Exercise

    result = await session.execute(select(Exercise).where(Exercise.visibility == "system"))
    return {exercise.name_normalized: exercise for exercise in result.scalars().all()}


async def _clear_user_data(session: AsyncSession, *, user_id: UUID) -> tuple[int, int]:
    from sqlalchemy import delete, func, select
    from app.infrastructure.database.models import Exercise, Workout

    workout_count = await session.scalar(select(func.count()).select_from(Workout).where(Workout.user_id == user_id))
    private_exercise_count = await session.scalar(
        select(func.count()).select_from(Exercise).where(Exercise.user_id == user_id, Exercise.visibility == "private")
    )

    await session.execute(delete(Workout).where(Workout.user_id == user_id))
    await session.execute(delete(Exercise).where(Exercise.user_id == user_id, Exercise.visibility == "private"))
    return int(workout_count or 0), int(private_exercise_count or 0)


async def _import_entities(
    session: AsyncSession,
    *,
    user: User,
    backup: BackupImportData,
) -> tuple[int, int]:
    from app.infrastructure.database.models import Exercise, Workout, WorkoutExercise, WorkoutSet

    system_exercises = await _load_system_exercises(session)
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


def _validate_top_level(payload: dict[str, Any]) -> None:
    missing = REQUIRED_TOP_LEVEL_KEYS.difference(payload.keys())
    if missing:
        raise BackupValidationError(f"backup payload is missing keys: {sorted(missing)}")


def _parse_utc_naive(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)


def _build_workout_notes(*, calendar_day: dict[str, Any], training: dict[str, Any]) -> str:
    lines = [
        "Imported from GymTracker backup",
        f"calendarDayId: {calendar_day['id']}",
        f"trainingId: {training['id']}",
        f"isTrainingSeeing: {calendar_day.get('isTrainingSeeing', False)}",
    ]

    background_image_url = training.get("backgroundImageURL")
    if background_image_url:
        lines.append(f"backgroundImageURL: {background_image_url}")

    lines.append(f"hasBackgroundImageData: {bool(training.get('backgroundImageData'))}")

    description = (training.get("trainingDescription") or "").strip()
    if description:
        lines.append(f"trainingDescription: {description}")

    return "\n".join(lines)
