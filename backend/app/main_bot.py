import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher, types
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

from app.core.config import settings

# Настройка логирования
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

dp = Dispatcher()


def get_bot() -> Bot:
    if not settings.BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is required to run the bot service")

    return Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def get_web_app_url() -> str:
    if not settings.WEBAPP_BASE_URL:
        raise RuntimeError("WEBAPP_BASE_URL is required to run the bot service")

    return settings.WEBAPP_BASE_URL

@dp.message(CommandStart())
async def cmd_start_handler(message: types.Message):
    """
    Хендлер команды /start. Приветствует пользователя и выдает кнопку для открытия WebApp.
    """
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏋️‍♂️ Открыть дневник тренировок", web_app=WebAppInfo(url=get_web_app_url()))]
    ])

    welcome_text = (
        f"Привет, {message.from_user.full_name}! 👋\n\n"
        f"Я бот-дневник тренировок. Нажми на кнопку ниже, чтобы запустить приложение."
    )

    await message.answer(welcome_text, reply_markup=kb)

async def start_polling():
    """Запуск бота в режиме long polling. В будущем можно переделать на webhooks."""
    logger.info("Starting bot (polling mode)...")
    bot = get_bot()
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(start_polling())
    except KeyboardInterrupt:
        logger.info("Bot stopped!")
