from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional

class UserRead(BaseModel):
    id: UUID
    tg_id: int
    username: Optional[str]
    language_code: str
    timezone: str

    model_config = {"from_attributes": True}

class TokenPayload(BaseModel):
    sub: str # tg_id
    user_id: str # UUID in db
    exp: int

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead

class InitDataRequest(BaseModel):
    initData: str = Field(..., description="Raw initData string from Telegram WebApp")
