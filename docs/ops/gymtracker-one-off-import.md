# GymTracker One-Off Import

Этот импортёр предназначен только для одноразового переноса historical data из `*.gymtracker` в текущую БД SantaGymBot.

## Preconditions

- у целевого пользователя уже есть запись в таблице `users`
- `.env` загружен
- `DATABASE_URL` экспортирован явно
- перед продом сделан backup БД

## Dry Run

```bash
cd /Users/santa/PycharmProjects/SantaGymBot
set -a
source .env
export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
set +a

PYTHONPATH=backend .venv/bin/python -m ops.one_off.import_gymtracker_backup \
  --backup-file "/absolute/path/to/backup 17.04.2026.gymtracker" \
  --username santariver \
  --dry-run
```

Expected counts for the studied backup:

- `workout_count = 54`
- `workout_exercise_count = 250`
- `workout_set_count = 774`
- `skipped_calendar_days_without_training = 8`
- `skipped_sets_with_nonpositive_reps = 18`
- `reused_system_exercise_count = 6`
- `created_private_exercise_count = 57`

## Import

```bash
PYTHONPATH=backend .venv/bin/python -m ops.one_off.import_gymtracker_backup \
  --backup-file "/absolute/path/to/backup 17.04.2026.gymtracker" \
  --username santariver
```

Если нужно заменить уже существующие тренировки и приватные упражнения пользователя:

```bash
PYTHONPATH=backend .venv/bin/python -m ops.one_off.import_gymtracker_backup \
  --backup-file "/absolute/path/to/backup 17.04.2026.gymtracker" \
  --username santariver \
  --replace-existing
```

## Validation

- проверить JSON summary после `--dry-run`
- проверить количество тренировок пользователя в БД
- проверить, что фронтенд читает тот же API и ту же БД
- проверить, что история тренировок отображается под аккаунтом `santariver`

## Cleanup

После успешного прод-переноса:

- сохранить этот runbook вместе с фактическим JSON output dry-run/import
- удалить каталог `backend/ops/one_off/` из основной ветки, если он больше не нужен
