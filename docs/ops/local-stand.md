# Local Stand

Локальный стенд предназначен для ежедневной разработки `backend` и `frontend` без обязательного запуска Telegram-бота.

## Сервисы

- `db`
- `redis`
- `backend`
- `frontend`

`bot` не входит в обычный local workflow.

## First Run

```bash
cp .env.local.example .env.local
make local-init
make local-up
```

После запуска:
- API доступен на `http://localhost:8000`
- frontend доступен на `http://localhost:5173`

## Команды

```bash
make local-up
make local-down
make local-logs
make local-migrate
```

## Auth

Local стенд использует controlled fallback auth через `test_mode=...`.

Правила:
- fallback должен работать только при `ALLOW_TEST_AUTH=true`
- это допустимо для локальной UI/API разработки
- это не заменяет реальную проверку Telegram WebApp авторизации

## Hot Reload

- backend работает через `uvicorn --reload`
- frontend работает через Vite dev server
- для Docker Desktop включен polling через env в `.env.local`
