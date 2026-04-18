from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    BOT_TOKEN: str | None = None
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str
    WEBHOOK_URL: str = ""
    WEBAPP_BASE_URL: str | None = None
    ALLOW_TEST_AUTH: bool = False
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
