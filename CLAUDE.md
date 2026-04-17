# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SantaGymBot is a Telegram WebApp workout tracker — a monorepo with a Python backend (FastAPI + aiogram) and a React frontend (TWA). Users authenticate via Telegram's `initData` HMAC verification, receive a JWT, and use the web app to track workouts.

## Commands

### Backend
```bash
# Run full stack
docker compose up -d --build

# Apply DB migrations
docker compose exec backend alembic upgrade head

# Generate new migration after model changes
docker compose exec backend alembic revision --autogenerate -m "reason"
docker compose exec backend alembic upgrade head
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # dev server at http://localhost:5173
npm run build
npm run lint     # eslint
```

## Architecture

### Backend — Clean Architecture
`backend/app/` is split into 4 layers:
- **`domain/schemas/`** — Pydantic DTOs (auth, exercise, workout)
- **`application/services/`** — business logic / use-cases
- **`infrastructure/database/`** — SQLAlchemy models, asyncpg, Alembic migrations, Repository pattern
- **`presentation/api_v1/routers/`** — FastAPI routers (auth, exercises, workouts)

Two entry points share the same DB/Redis:
- `main_api.py` — REST API for the Web App (served via Traefik at `api.gym.santariver.lol`)
- `main_bot.py` — aiogram 3.x Telegram bot daemon (polling/webhook)

### Frontend — React SPA
`frontend/src/`:
- `api/` — Axios client with JWT interceptors
- `store/` — Zustand auth store (with persist)
- `pages/` — screen components
- `App.tsx` — React Router entry

### Auth Flow
1. Frontend sends `window.Telegram.WebApp.initData` to `POST /api/v1/auth/`
2. Backend HMAC-SHA256 verifies it against `BOT_TOKEN`
3. Backend returns Bearer JWT used for all subsequent requests
4. In local browser dev (non-Telegram), auth bypass creates a test user

### Infrastructure
Traefik is the reverse proxy handling SSL (Let's Encrypt) and routing. `db` and `redis` are on `internal_network` only; `backend` and `frontend` are on both `proxy_network` and `internal_network`.

### Key env vars (`.env`)
- `BOT_TOKEN` — Telegram bot token from @BotFather
- `JWT_SECRET` — secret for signing JWTs
- `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`
- `WEBHOOK_URL` — public URL for Telegram webhook (production)

## Database

PostgreSQL 16 via SQLAlchemy 2.0 async (asyncpg). All `datetime` fields use `TIMESTAMP WITHOUT TIME ZONE` — timezone info must be stripped before saving. Models: `User`, `Exercise`, `Workout`, `WorkoutExercise` (with sets). Cascading deletes are configured at the DB level.

## CI/CD

GitHub Actions deploys to VPS on push to `main` via SCP + `docker compose up`. Required secrets: `HOST`, `USERNAME`, `SSH_KEY`.
