from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def resolve_user_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        return ZoneInfo("UTC")


def workout_reference_time(workout) -> datetime:
    return workout.start_time or workout.created_at


def to_local_datetime(value: datetime, user_timezone: ZoneInfo) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(user_timezone)


def calculate_period_bounds(period: str, timezone_name: str) -> tuple[datetime | None, datetime | None]:
    if period == "all":
        return None, None

    if period != "month":
        raise ValueError("Unsupported stats period")

    user_timezone = resolve_user_timezone(timezone_name)
    now_local = datetime.now(user_timezone)
    month_start_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if month_start_local.month == 12:
        next_month_local = month_start_local.replace(year=month_start_local.year + 1, month=1)
    else:
        next_month_local = month_start_local.replace(month=month_start_local.month + 1)

    return (
        month_start_local.astimezone(timezone.utc).replace(tzinfo=None),
        next_month_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def current_week_start_utc(timezone_name: str) -> datetime:
    user_timezone = resolve_user_timezone(timezone_name)
    now_local = datetime.now(user_timezone)
    return (
        (now_local - timedelta(days=now_local.weekday()))
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )


def build_empty_stats_payload(period: str, timezone_name: str) -> dict:
    activity_by_week = []
    if period == "month":
        current_week_start = current_week_start_utc(timezone_name)
        activity_by_week = [
            {
                "week_start": current_week_start - timedelta(weeks=offset),
                "training_days": 0,
                "completed_workouts": 0,
            }
            for offset in range(7, -1, -1)
        ]

    return {
        "period": period,
        "summary": {
            "training_days": 0,
            "completed_workouts": 0,
            "total_sets": 0,
            "total_duration_minutes": 0,
        },
        "activity_by_week": activity_by_week,
        "top_exercises": [],
        "generated_at": datetime.now(timezone.utc).replace(tzinfo=None),
    }


def build_stats_payload(period: str, timezone_name: str, workouts: list) -> dict:
    if not workouts:
        return build_empty_stats_payload(period, timezone_name)

    user_timezone = resolve_user_timezone(timezone_name)
    training_days: set[str] = set()
    weekly_activity: dict[datetime, dict[str, object]] = {}
    top_exercises: dict[object, dict[str, object]] = {}
    total_sets = 0
    total_duration_minutes = 0

    for workout in workouts:
        reference_time = workout_reference_time(workout)
        local_reference = to_local_datetime(reference_time, user_timezone)
        local_day = local_reference.date().isoformat()
        training_days.add(local_day)

        week_start_local = (local_reference - timedelta(days=local_reference.weekday())).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        week_start_utc = week_start_local.astimezone(timezone.utc).replace(tzinfo=None)
        if week_start_utc not in weekly_activity:
            weekly_activity[week_start_utc] = {
                "days": set(),
                "completed_workouts": 0,
            }
        weekly_activity[week_start_utc]["days"].add(local_day)
        weekly_activity[week_start_utc]["completed_workouts"] += 1

        if workout.start_time and workout.end_time:
            duration_seconds = max(
                int((workout.end_time - workout.start_time).total_seconds()),
                0,
            )
            total_duration_minutes += duration_seconds // 60

        for workout_exercise in workout.workout_exercises:
            set_count = len(workout_exercise.sets)
            total_sets += set_count

            if not workout_exercise.exercise:
                continue

            exercise_id = workout_exercise.exercise.id
            if exercise_id not in top_exercises:
                top_exercises[exercise_id] = {
                    "exercise_id": exercise_id,
                    "name": workout_exercise.exercise.name,
                    "workout_ids": set(),
                    "set_count": 0,
                    "last_used_at": None,
                }

            exercise_entry = top_exercises[exercise_id]
            exercise_entry["workout_ids"].add(workout.id)
            exercise_entry["set_count"] += set_count
            last_used_at = exercise_entry["last_used_at"]
            if last_used_at is None or reference_time > last_used_at:
                exercise_entry["last_used_at"] = reference_time

    activity_by_week = [
        {
            "week_start": week_start,
            "training_days": len(values["days"]),
            "completed_workouts": int(values["completed_workouts"]),
        }
        for week_start, values in sorted(weekly_activity.items())
    ]

    if period == "month":
        latest_week_start = current_week_start_utc(timezone_name)
        window_starts = [latest_week_start - timedelta(weeks=offset) for offset in range(7, -1, -1)]
        activity_lookup = {item["week_start"]: item for item in activity_by_week}
        activity_by_week = [
            activity_lookup.get(
                week_start,
                {
                    "week_start": week_start,
                    "training_days": 0,
                    "completed_workouts": 0,
                },
            )
            for week_start in window_starts
        ]

    top_exercise_items = sorted(
        [
            {
                "exercise_id": item["exercise_id"],
                "name": item["name"],
                "workout_count": len(item["workout_ids"]),
                "set_count": int(item["set_count"]),
                "last_used_at": item["last_used_at"],
            }
            for item in top_exercises.values()
        ],
        key=lambda item: (-item["set_count"], -(item["last_used_at"].timestamp() if item["last_used_at"] else 0), item["name"]),
    )[:5]

    return {
        "period": period,
        "summary": {
            "training_days": len(training_days),
            "completed_workouts": len(workouts),
            "total_sets": total_sets,
            "total_duration_minutes": total_duration_minutes,
        },
        "activity_by_week": activity_by_week,
        "top_exercises": top_exercise_items,
        "generated_at": datetime.now(timezone.utc).replace(tzinfo=None),
    }
