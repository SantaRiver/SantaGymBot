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

## 🚀 Локальная разработка

### Требования
* Docker & Docker Compose
* Node.js (v20+)
* Python 3.12+ / Poetry (Опционально, если запускать бэк без докера)

### 1. Подготовка окружения
Клонируйте репозиторий и создайте файл секретов окружения:
```bash
git clone <repository_url>
cd SantaGymBot
cp .env.example .env
```

Отредактируйте `.env`:
* Обязательно укажите `BOT_TOKEN` (получив его у @BotFather в Telegram).
* Сгенерируйте `JWT_SECRET` (любая длинная случайная строка).

### 2. Запуск Backend + Инфраструктура
Мы используем Docker для поднятия Базы данных (PostgreSQL), Кэша (Redis) и самого Бэкенда (API + Bot).

```bash
docker compose up -d --build
```
> **Внимание:** В локальном режиме бэкенд будет доступен Траефиком по хосту `api.santagym.local` (если прописать его в `/etc/hosts` локальной машины), либо можно маппить порты `8000:8000` напрямую для тестов.

### 3. Накатываем миграции Базы Данных
Чтобы в БД появились таблицы, необходимо применить миграции Alembic:

```bash
docker compose exec backend alembic upgrade head
```

*(Если вы модифицировали модели и нужно создать новую миграцию):*
```bash
docker compose exec backend alembic revision --autogenerate -m "reason"
docker compose exec backend alembic upgrade head
```

### 4. Запуск Frontend
В отдельном окне терминала перейдите в папку `frontend`:

```bash
cd frontend
npm install
npm run dev
```
Фронтенд запустится на `http://localhost:5173`.
> **Для справки:** При тестировании фронта локально (в браузере, а не внутри Telegram), инициализация будет проходить через заглушку (bypass auth), создавая "тестового пользователя", чтобы вы могли разрабатывать UI без подключения дебаггера смартфона.

---

## 🌍 Production Деплой (Развертывание на сервер)

Проект спроектирован так, чтобы его можно было безболезненно развернуть на VPS (Ubuntu/Debian) без лишних конфликтов портов благодаря использованию сетки Traefik.

### 1. Настройка домена
Направьте A-запись вашего домена (например, `gymbot.example.com` и `api.gymbot.example.com`) на IP вашего сервера.

### 2. Подготовка .env для PROD
В файле `.env` на сервере:
```dotenv
WEBHOOK_URL=https://api.gymbot.example.com/api/v1/webhook
JWT_SECRET=super_strong_production_key...
POSTGRES_PASSWORD=super_strong_password
...
```

### 3. Изменение Traefik-конфигурации (docker-compose)
В prod-окружении необходимо:
1. Заменить `--api.insecure=true` на SSL/Let's Encrypt Entrypoints в настройках `traefik`.
2. Добавить метки (labels) для `frontend` контейнера (напишите prod-dockerfile, который собирает статику и отдает через `nginx`). Либо отдавать статику через CDN.
3. Обновить label хоста бэкенда:
   ```yaml
   - "traefik.http.routers.backend.rule=Host(`api.gymbot.example.com`)"
   ```

### 4. Запуск и миграция
```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

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

This project has CI/CD configured using GitHub Actions. Upon pushing to the `main` branch, the code is copied via SCP and started using docker-compose on the target server.

### Setup Server Secrets
Navigate to **Settings > Secrets and variables > Actions** in your GitHub repository and add:
- `HOST`: Server IP Address (`YOUR_SERVER_IP`)
- `USERNAME`: Server User (`YOUR_SERVER_USER`)
- `SSH_KEY`: The private Ed25519 or RSA SSH key to access the VPS

### Initial Server Setup
Make sure the folder exists and create a `.env` file containing the protected API tokens:
```bash
# Connect to your server
ssh root@204.168.249.237
mkdir -p /opt/santagym
cd /opt/santagym
nano .env
```

Fill the `.env` with your variables (`BOT_TOKEN`, `POSTGRES_USER`, etc).
