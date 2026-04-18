from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.application.services.workout_stats import build_stats_payload  # noqa: E402


def make_workout(
    *,
    start_time: datetime | None,
    end_time: datetime | None,
    created_at: datetime,
    exercise_defs: list[tuple[str, int, UUID | None]],
):
    workout_id = uuid4()
    exercises = []
    for name, set_count, exercise_key in exercise_defs:
        exercise_id = uuid4() if exercise_key is None else exercise_key
        exercises.append(
            SimpleNamespace(
                exercise=SimpleNamespace(id=exercise_id, name=name),
                sets=[SimpleNamespace(id=uuid4()) for _ in range(set_count)],
            )
        )

    return SimpleNamespace(
        id=workout_id,
        start_time=start_time,
        end_time=end_time,
        created_at=created_at,
        workout_exercises=exercises,
    )


class WorkoutStatsTests(unittest.TestCase):
    def test_build_stats_counts_unique_training_days_in_user_timezone(self) -> None:
        workouts = [
            make_workout(
                start_time=datetime(2026, 4, 1, 22, 30),
                end_time=datetime(2026, 4, 1, 23, 30),
                created_at=datetime(2026, 4, 1, 22, 30),
                exercise_defs=[("Жим лежа", 3, None)],
            ),
            make_workout(
                start_time=datetime(2026, 4, 2, 1, 0),
                end_time=datetime(2026, 4, 2, 2, 0),
                created_at=datetime(2026, 4, 2, 1, 0),
                exercise_defs=[("Присед", 4, None)],
            ),
        ]

        stats = build_stats_payload("month", "Asia/Ho_Chi_Minh", workouts)

        self.assertEqual(stats["summary"]["training_days"], 1)
        self.assertEqual(stats["summary"]["completed_workouts"], 2)
        self.assertEqual(stats["summary"]["total_sets"], 7)
        self.assertEqual(stats["summary"]["total_duration_minutes"], 120)

    def test_build_stats_uses_created_at_when_start_time_missing(self) -> None:
        workout = make_workout(
            start_time=None,
            end_time=None,
            created_at=datetime(2026, 4, 17, 10, 15),
            exercise_defs=[("Подтягивания", 2, None)],
        )

        stats = build_stats_payload("month", "UTC", [workout])

        self.assertEqual(stats["summary"]["training_days"], 1)
        self.assertEqual(stats["summary"]["total_duration_minutes"], 0)
        self.assertEqual(len(stats["activity_by_week"]), 8)

    def test_build_stats_limits_top_exercises_and_sorts_by_set_count_then_recency(self) -> None:
        lat_pulldown_id = uuid4()
        older = make_workout(
            start_time=datetime(2026, 4, 10, 8, 0),
            end_time=datetime(2026, 4, 10, 9, 0),
            created_at=datetime(2026, 4, 10, 8, 0),
            exercise_defs=[("Тяга блока", 5, lat_pulldown_id), ("Жим сидя", 3, None)],
        )
        newer = make_workout(
            start_time=datetime(2026, 4, 12, 8, 0),
            end_time=datetime(2026, 4, 12, 9, 0),
            created_at=datetime(2026, 4, 12, 8, 0),
            exercise_defs=[
                ("Тяга блока", 1, lat_pulldown_id),
                ("Бицепс", 6, None),
                ("Плечи", 2, None),
                ("Трицепс", 1, None),
                ("Икры", 1, None),
            ],
        )

        stats = build_stats_payload("all", "UTC", [older, newer])

        self.assertEqual(len(stats["top_exercises"]), 5)
        self.assertEqual(stats["top_exercises"][0]["name"], "Бицепс")
        self.assertEqual(stats["top_exercises"][0]["set_count"], 6)
        self.assertEqual(stats["top_exercises"][1]["name"], "Тяга блока")


if __name__ == "__main__":
    unittest.main()
