from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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
