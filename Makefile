LOCAL_COMPOSE=docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml
SERVER_COMPOSE=docker compose --env-file .env.server -f docker-compose.yml -f docker-compose.server.yml

local-up:
	$(LOCAL_COMPOSE) up --build -d db redis backend frontend

local-down:
	$(LOCAL_COMPOSE) down

local-logs:
	$(LOCAL_COMPOSE) logs -f backend frontend db redis

local-migrate:
	$(LOCAL_COMPOSE) exec backend alembic upgrade head

local-init:
	$(LOCAL_COMPOSE) up --build -d db redis backend
	$(LOCAL_COMPOSE) exec backend alembic upgrade head

server-config:
	$(SERVER_COMPOSE) config
