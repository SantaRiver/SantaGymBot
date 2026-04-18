# Server Stand

Серверный стенд предназначен для runtime-развертывания с `Traefik`, Telegram-ботом и production-like маршрутизацией.

## Сервисы

- `traefik`
- `db`
- `redis`
- `backend`
- `bot`
- `frontend`

## Назначение Traefik

`Traefik` используется как edge-router:
- принимает входящий трафик на `80/443`
- завершает TLS
- маршрутизирует frontend и backend по host rules
- позволяет размещать несколько ботов и WebApp на одном сервере без конфликтов внешних портов

## Конфигурация

Создайте `.env.server` из шаблона:

```bash
cp .env.server.example .env.server
```

Заполните как минимум:
- `BOT_TOKEN`
- `JWT_SECRET`
- `WEBAPP_BASE_URL`
- `WEBHOOK_URL`
- `FRONTEND_HOST`
- `API_HOST`
- `TRAEFIK_ACME_EMAIL`

## Проверка конфигурации

```bash
make server-config
docker compose --env-file .env.server -f docker-compose.yml -f docker-compose.server.yml config
```

## Boundary

- server стенд не оптимизирован под HMR и ежедневную разработку
- local стенд не симулирует production ingress
- реальная Telegram WebApp авторизация проверяется здесь или в отдельном integration-сценарии, где есть `bot` и корректный `WEBAPP_BASE_URL`
