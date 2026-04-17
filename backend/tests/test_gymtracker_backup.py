from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.application.services.gymtracker_backup import (  # noqa: E402
    BackupValidationError,
    parse_backup_file,
    parse_backup_payload,
    summarize_backup,
)


class GymTrackerBackupTests(unittest.TestCase):
    def test_real_backup_summary_matches_expected_counts(self) -> None:
        data = parse_backup_file(REPO_ROOT / "backup 17.04.2026.gymtracker")

        self.assertEqual(len(data.exercises), 63)
        self.assertEqual(len(data.workouts), 54)
        self.assertEqual(data.skipped_calendar_days_without_training, 8)
        self.assertEqual(data.skipped_sets_with_nonpositive_reps, 18)
        self.assertEqual(summarize_backup(data)["workout_exercise_count"], 250)
        self.assertEqual(summarize_backup(data)["workout_set_count"], 774)

    def test_notes_keep_supported_metadata(self) -> None:
        data = parse_backup_file(REPO_ROOT / "backup 17.04.2026.gymtracker")
        workout = data.workouts[0]

        self.assertIn("Imported from GymTracker backup", workout.notes or "")
        self.assertIn("calendarDayId:", workout.notes or "")
        self.assertIn("trainingId:", workout.notes or "")
        self.assertIn("backgroundImageURL:", workout.notes or "")
        self.assertIn("hasBackgroundImageData: True", workout.notes or "")

    def test_zero_weight_is_kept_but_nonpositive_reps_are_dropped(self) -> None:
        payload = {
            "exerciseSetApproaches": [
                {"id": "a-keep", "repeats": 10, "weight": 0},
                {"id": "a-drop", "repeats": 0, "weight": 50},
                {"id": "a-drop-2", "repeats": -1, "weight": 20},
            ],
            "exerciseSupersets": [],
            "exercises": [
                {
                    "id": "ex-1",
                    "name": "Подтягивания",
                    "categoryId": "backCategory",
                    "isUsingGrips": False,
                    "isWeightDoubled": False,
                    "isUsingSelfWeight": True,
                }
            ],
            "exerciseSets": [{"id": "set-1", "exerciseId": "ex-1", "approachIds": ["a-keep", "a-drop", "a-drop-2"]}],
            "trainings": [
                {
                    "id": "training-1",
                    "name": "",
                    "trainingDescription": "",
                    "backgroundImageURL": "bg-1",
                    "backgroundImageData": "base64",
                    "exerciseSetIds": ["set-1"],
                }
            ],
            "calendarDays": [
                {
                    "id": "day-1",
                    "date": "2026-04-17T02:48:47Z",
                    "isTrainingSeeing": True,
                    "trainingId": "training-1",
                }
            ],
            "programs": [],
            "backupDate": "2026-04-17T02:48:47Z",
        }

        data = parse_backup_payload(payload)

        self.assertEqual(data.skipped_sets_with_nonpositive_reps, 2)
        imported_sets = data.workouts[0].exercises[0].sets
        self.assertEqual(len(imported_sets), 1)
        self.assertEqual(imported_sets[0].reps, 10)
        self.assertEqual(imported_sets[0].weight, 0.0)

    def test_missing_top_level_key_raises_validation_error(self) -> None:
        with self.assertRaises(BackupValidationError):
            parse_backup_payload({"backupDate": "2026-04-17T02:48:47Z"})


if __name__ == "__main__":
    unittest.main()
