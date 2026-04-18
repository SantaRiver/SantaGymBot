# 🏋️‍♂️ SantaGymBot - Telegram WebApp Workout Tracker

Полноценный production-ready проект для трекинга тренировок. Реализован в виде Telegram-бота со встроенным WebApp для удобного управления своим тренировочным прогрессом.

## 🌟 Особенности проекта

- **Telegram-Native Authorization:** Бесшовная авторизация пользователей через криптографическую проверку `Telegram initData`. Не требуются пароли или логины.
- **Production-Ready Архитектура:** Backend спроектирован по паттернам **Clean Architecture** (разделение Domain, Application, Infrastructure и Presentation слоев).
- **Продвинутая БД:** Реляционная структура на **PostgreSQL** с каскадным удалением, оптимизированными отношениями и асинхронным доступом через `sqlalchemy 2.0`.
- **Modern Frontend:** Легкий и быстрый SPA WebApp на **React + Vite** с глобальным стейтом на **Zustand** и кастомизируемой версткой на **TailwindCSS**.
- **DevOps & Scaling:** Portable-инфраструктура на **Docker Compose**. Использование **Traefik** в роли API-gateway для возможности разворачивать десятки независимых демонов ботов на одном сервере без конфликта 80/443 портов.

---

## 🛠 Технологический стек

### Backend
* **Language:** Python 3.12+
* **Framework:** FastAPI (REST API для WebApp) + aiogram 3.x (для Telegram бота)
* **Database:** PostgreSQL 16
* **Cache/State:** Redis 7
* **ORM & Migrations:** SQLAlchemy 2.0 + asyncpg + Alembic
* **Auth:** JWT, HMAC-SHA256 (Telegram initData crypto verification)

### Frontend
* **Core:** React 19 + TypeScript + Vite
* **State Management:** Zustand (с persist для будущего Offline-First)
* **Styling:** TailwindCSS v4 + Lucide React (иконки)
* **HTTP Client:** Axios с JWT Interceptors
* **Integration:** `@twa-dev/sdk` (Telegram Web App SDK)

### Infrastructure
* Docker & Docker Compose
* Traefik (Reverse Proxy / Load Balancer / SSL termination)

---

## 📁 Структура репозитория

```text
SantaGymBot/
├── backend/                  # Clean Architecture Python Backend
│   ├── app/
│   │   ├── main_bot.py       # Точка входа Telegram-бота
│   │   ├── main_api.py       # Точка входа FastAPI
│   │   ├── core/             # Конфигурация
│   │   ├── domain/           # Бизнес-модели, Pydantic DTOs
│   │   ├── application/      # Сервисный слой, Use-Cases, Auth
│   │   ├── infrastructure/   # SQLAlchemy конфигурация, миграции, Repository Pattern
│   │   └── presentation/     # FastAPI роутеры (REST API)
├── frontend/                 # React Web App
│   ├── src/
│   │   ├── api/              # Настройка Axios клиента
│   │   ├── store/            # Zustand хранилище (авторизация)
│   │   ├── pages/            # Экраны и представления
│   │   └── App.tsx           # Роутер
├── docker-compose.yml        # Инфраструктурный манифест
└── .env.example              # Шаблон переменных окружения
```

---

## 🚀 Local Development

### Требования
* Docker & Docker Compose
* GNU Make
* Node.js / Python локально не обязательны, если используете только Docker

### 1. Подготовка окружения
Клонируйте репозиторий и создайте local env:
```bash
git clone <repository_url>
cd SantaGymBot
cp .env.local.example .env.local
```

### 2. Первый запуск

```bash
make local-init
make local-up
```

Локальный стенд поднимает:
- `db`
- `redis`
- `backend`
- `frontend`

`bot` в обычный local workflow не входит.

### 3. Адреса сервисов

- API: `http://localhost:8000`
- Frontend: `http://localhost:5173`

### 4. Миграции

```bash
make local-migrate
```

### 5. Логи и остановка

```bash
make local-logs
make local-down
```

### 6. Local Auth

Локальная разработка использует controlled fallback auth через `test_mode`, если в `.env.local` включен `ALLOW_TEST_AUTH=true`.

Это подходит для:
- UI разработки
- локальной проверки API
- быстрой отладки в браузере

Это не заменяет реальную проверку Telegram WebApp авторизации.

Детали: [local-stand.md](/Users/santa/PycharmProjects/SantaGymBot/docs/ops/local-stand.md:1)

---

## 🌍 Server Deployment

Серверный режим использует отдельный compose override с `Traefik`, `bot` и production-oriented frontend runtime.

### 1. Подготовка env

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

### 2. Проверка server topology

```dotenv
make server-config
```

### 3. Запуск server stack

```bash
docker compose --env-file .env.server -f docker-compose.yml -f docker-compose.server.yml up -d --build
docker compose --env-file .env.server -f docker-compose.yml -f docker-compose.server.yml exec backend alembic upgrade head
```

`Traefik` здесь нужен для host-based routing и размещения нескольких ботов/WebApp на одном сервере без конфликта внешних портов `80/443`.

Детали: [server-stand.md](/Users/santa/PycharmProjects/SantaGymBot/docs/ops/server-stand.md:1)

## 🧪 Dev Server Deployment

Dev-стенд на сервере разворачивается как отдельный stack рядом с prod:
- отдельная директория, например `/opt/santagym-dev`
- отдельный env-файл `.env.dev`
- отдельные Postgres/Redis volumes
- отдельные домены, например `dev.gym.santariver.lol` и `dev-api.gym.santariver.lol`
- тот же сервер и тот же `Traefik`, но другой compose project name

### Подготовка env

```bash
cp .env.dev.example .env.dev
```

Заполните как минимум:
- `BOT_TOKEN`
- `JWT_SECRET`
- `WEBAPP_BASE_URL`
- `WEBHOOK_URL`
- `FRONTEND_HOST`
- `API_HOST`
- `TRAEFIK_ACME_EMAIL`

### Автодеплой

После push/merge в `develop` workflow `Deploy Dev to VPS`:
- копирует код в `/opt/santagym-dev`
- использует `.env.dev`
- запускает отдельный compose project `santagym-dev`
- прогоняет миграции
- проверяет health backend/frontend

---

## 🔒 Модель безопасности

Никогда не передавайте `tg_id` юзера сырым в REST запросах между WebApp и сервером.
1. При старте WebApp клиент отправляет на бекэнд payload `window.Telegram.WebApp.initData`.
2. Backend (через `hmac-sha256`) верифицирует, что эти данные были сгенерированы Телеграмом именно для вашего бота (сопоставляя с вашим `BOT_TOKEN`).
3. Бекэнд выдает стандартизированный `Bearer JWT` Token, который используется для аутентификации всех последующих REST-запросов.

---

## 📝 Развитие продукта
- [ ] Описать компонент Frontend'а для "Активной сессии тренировки"
- [ ] Интегрировать графики прогресса по весам (Recharts)
- [ ] Настроить Celery + Redis Task Queue для отправки push-напоминаний, если юзер не закончил тренировку.
- [ ] Реализовать Offline-sync (передача сетов батчами, если исчезал интернет).

## Deployment (GitHub Actions)

This project has CI/CD configured using GitHub Actions. The pipeline validates frontend, backend and compose configuration. Deployment uses the server compose topology.

### Setup Server Secrets
Navigate to **Settings > Secrets and variables > Actions** in your GitHub repository and add:
- `HOST`: Server IP Address (`YOUR_SERVER_IP`)
- `USERNAME`: Server User (`YOUR_SERVER_USER`)
- `SSH_KEY`: The private Ed25519 or RSA SSH key to access the VPS

### Initial Server Setup
Make sure the folder exists and create a `.env.server` file containing the protected runtime secrets:
```bash
# Connect to your server
ssh root@YOUR_SERVER_IP
mkdir -p /opt/santagym
cd /opt/santagym
nano .env.server
```

Fill `.env.server` with your variables (`BOT_TOKEN`, `POSTGRES_USER`, `WEBAPP_BASE_URL`, etc).
