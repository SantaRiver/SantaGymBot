import json
import hmac
import hashlib
from urllib.parse import parse_qsl
from datetime import datetime, timedelta

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.infrastructure.database.repositories.user import user_repo

class AuthService:
    def __init__(self, bot_token: str | None, jwt_secret: str):
        self.bot_token = bot_token
        self.jwt_secret = jwt_secret

    def validate_telegram_data(self, init_data: str) -> dict:
        """
        Провалидировать initData от Telegram WebApp.
        Возвращает распаршенный JSON пользователя или кидает ValueError.
        """
        if not self.bot_token:
            raise ValueError("BOT_TOKEN is not configured")

        parsed_data = dict(parse_qsl(init_data))
        if "hash" not in parsed_data:
            raise ValueError("No hash in init_data")

        hash_val = parsed_data.pop("hash")

        # Сортируем ключи по алфавиту и склеиваем
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed_data.items())
        )

        # Создаем секретный ключ на основе токена бота
        secret_key = hmac.new(
            key=b"WebAppData",
            msg=self.bot_token.encode("utf-8"),
            digestmod=hashlib.sha256
        ).digest()

        # Вычисляем HMAC-SHA-256
        calculated_hash = hmac.new(
            key=secret_key,
            msg=data_check_string.encode("utf-8"),
            digestmod=hashlib.sha256
        ).hexdigest()

        if calculated_hash != hash_val:
            raise ValueError("Invalid hash. Data is fake.")

        return json.loads(parsed_data.get("user", "{}"))

    def create_access_token(self, tg_id: int, user_id: str) -> str:
        """Создать JWT токен для пользователя"""
        expire = datetime.utcnow() + timedelta(days=7) # Токен на 7 дней
        to_encode = {
            "sub": str(tg_id),
            "user_id": str(user_id),
            "exp": expire
        }
        encoded_jwt = jwt.encode(to_encode, self.jwt_secret, algorithm="HS256")
        return encoded_jwt

    async def authenticate_user(self, session: AsyncSession, init_data: str):
        """
        Основной флоу: Валидируем данные TG, ищем или создаем пользователя,
        возвращаем JWT токен.
        """
        tg_user_data = self.validate_telegram_data(init_data)
        if not tg_user_data:
            raise ValueError("No user data in initData")

        tg_id = tg_user_data.get("id")
        if not tg_id:
            raise ValueError("No user id in initData")

        # Ищем пользователя в БД
        user = await user_repo.get_by_tg_id(session, tg_id=tg_id)

        if not user:
            # Создаем нового пользователя
            user = await user_repo.create(session, obj_in={
                "tg_id": tg_id,
                "username": tg_user_data.get("username"),
                "language_code": tg_user_data.get("language_code", "en")
            })

        # Генерируем JWT
        token = self.create_access_token(tg_id=tg_id, user_id=str(user.id))
        return user, token

    async def _get_or_create_test_user(self, session: AsyncSession, tg_id: int):
        """Метод-заглушка для локального тестирования вне Telegram WebApp"""
        user = await user_repo.get_by_tg_id(session, tg_id=tg_id)
        if not user:
            user = await user_repo.create(session, obj_in={
                "tg_id": tg_id,
                "username": "test_user",
                "language_code": "en"
            })
        return user

auth_service = AuthService(bot_token=settings.BOT_TOKEN, jwt_secret=settings.JWT_SECRET)
