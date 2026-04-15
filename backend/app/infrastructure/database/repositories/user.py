from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.infrastructure.database.models import User
from app.infrastructure.database.repositories.base import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    async def get_by_tg_id(self, session: AsyncSession, tg_id: int) -> Optional[User]:
        stmt = select(User).where(User.tg_id == tg_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

user_repo = UserRepository()
