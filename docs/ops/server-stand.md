# Server Stand

Серверный стенд предназначен для runtime-развертывания с `Traefik`, Telegram-ботом и production-like маршрутизацией.

Он поддерживает два независимых server-side stack:
- `prod` через `.env.server` и compose project `santagym`
- `dev` через `.env.dev` и compose project `santagym-dev`

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

Для dev server stack создайте `.env.dev`:

```bash
cp .env.dev.example .env.dev
```

Рекомендуемые домены:
- `FRONTEND_HOST=dev.gym.santariver.lol`
- `API_HOST=dev-api.gym.santariver.lol`
- `TRAEFIK_ROUTER_PREFIX=santagym-dev`

## Проверка конфигурации

```bash
make server-config
docker compose --env-file .env.server -f docker-compose.yml -f docker-compose.server.yml config
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.server.yml config
```

## Boundary

- server стенд не оптимизирован под HMR и ежедневную разработку
- local стенд не симулирует production ingress
- реальная Telegram WebApp авторизация проверяется здесь или в отдельном integration-сценарии, где есть `bot` и корректный `WEBAPP_BASE_URL`
- `Traefik` должен существовать только в одном stack, обычно в `prod`
- dev stack не должен публиковать свои собственные `80/443`
- dev и prod не должны делить Postgres/Redis volumes или bot token
- dev и prod должны иметь разные `TRAEFIK_ROUTER_PREFIX`, чтобы не конфликтовать именами router/service
