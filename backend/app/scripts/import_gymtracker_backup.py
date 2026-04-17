from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from app.application.services.backup_import_service import BackupImportError, backup_import_service
from app.infrastructure.database.database import async_session_maker


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import a GymTracker JSON backup into SantaGymBot")
    parser.add_argument("--backup-file", required=True, help="Path to .gymtracker backup file")
    parser.add_argument("--username", required=True, help="Exact username to import data into")
    parser.add_argument(
        "--replace-existing",
        action="store_true",
        help="Delete the target user's workouts and private exercises before import",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize import without writing to the database",
    )
    return parser


async def main() -> int:
    args = build_parser().parse_args()
    backup_file = Path(args.backup_file)
    if not backup_file.exists():
        raise SystemExit(f"Backup file not found: {backup_file}")

    async with async_session_maker() as session:
        try:
            summary = await backup_import_service.import_backup(
                session,
                backup_file=backup_file,
                username=args.username,
                replace_existing=args.replace_existing,
                dry_run=args.dry_run,
            )
        except BackupImportError as exc:
            raise SystemExit(str(exc)) from exc

    print(
        json.dumps(
            {
                "username": summary.username,
                "user_id": str(summary.user_id) if summary.user_id else None,
                "dry_run": summary.dry_run,
                "replace_existing": args.replace_existing,
                "exercise_count": summary.exercise_count,
                "workout_count": summary.workout_count,
                "workout_exercise_count": summary.workout_exercise_count,
                "workout_set_count": summary.workout_set_count,
                "skipped_calendar_days_without_training": summary.skipped_calendar_days_without_training,
                "skipped_sets_with_nonpositive_reps": summary.skipped_sets_with_nonpositive_reps,
                "reused_system_exercise_count": summary.reused_system_exercise_count,
                "created_private_exercise_count": summary.created_private_exercise_count,
                "deleted_workout_count": summary.deleted_workout_count,
                "deleted_private_exercise_count": summary.deleted_private_exercise_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
