# backend/app/application/services/exercise_service.py
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.infrastructure.database.models import Exercise
from app.infrastructure.database.repositories.workout import exercise_repo


# Idempotent seed: only inserts exercises whose names don't exist yet as system exercises
SYSTEM_EXERCISES = [
    # Грудь
    {"name": "Жим штанги лёжа", "target_muscle_group": "Грудь"},
    {"name": "Жим гантелей лёжа", "target_muscle_group": "Грудь"},
    {"name": "Разводка гантелей лёжа", "target_muscle_group": "Грудь"},
    {"name": "Отжимания", "target_muscle_group": "Грудь"},
    # Спина
    {"name": "Подтягивания", "target_muscle_group": "Спина"},
    {"name": "Тяга штанги в наклоне", "target_muscle_group": "Спина"},
    {"name": "Тяга верхнего блока", "target_muscle_group": "Спина"},
    {"name": "Тяга гантели одной рукой", "target_muscle_group": "Спина"},
    # Ноги
    {"name": "Приседания со штангой", "target_muscle_group": "Ноги"},
    {"name": "Жим ногами", "target_muscle_group": "Ноги"},
    {"name": "Румынская тяга", "target_muscle_group": "Ноги"},
    {"name": "Выпады с гантелями", "target_muscle_group": "Ноги"},
    {"name": "Сгибание ног в тренажёре", "target_muscle_group": "Ноги"},
    # Плечи
    {"name": "Жим гантелей сидя", "target_muscle_group": "Плечи"},
    {"name": "Жим штанги стоя", "target_muscle_group": "Плечи"},
    {"name": "Подъём гантелей через стороны", "target_muscle_group": "Плечи"},
    # Бицепс
    {"name": "Сгибание рук со штангой", "target_muscle_group": "Бицепс"},
    {"name": "Сгибание рук с гантелями", "target_muscle_group": "Бицепс"},
    # Трицепс
    {"name": "Жим штанги узким хватом", "target_muscle_group": "Трицепс"},
    {"name": "Разгибание рук на блоке", "target_muscle_group": "Трицепс"},
    {"name": "Французский жим", "target_muscle_group": "Трицепс"},
    # Пресс
    {"name": "Скручивания", "target_muscle_group": "Пресс"},
    {"name": "Планка", "target_muscle_group": "Пресс"},
    {"name": "Подъём ног в висе", "target_muscle_group": "Пресс"},
    # Кардио
    {"name": "Бег на беговой дорожке", "target_muscle_group": "Кардио"},
    {"name": "Велотренажёр", "target_muscle_group": "Кардио"},
]


class ExerciseService:
    @staticmethod
    async def get_available_for_user(session: AsyncSession, user_id: UUID) -> List[Exercise]:
        """Returns system exercises + user's custom exercises."""
        return await exercise_repo.get_all_available_for_user(session, user_id)

    @staticmethod
    async def seed_system_exercises(session: AsyncSession) -> int:
        """Idempotent seed: inserts only missing system exercises. Returns count inserted."""
        # Fetch existing system exercise names
        stmt = select(Exercise).where(Exercise.user_id == None)
        result = await session.execute(stmt)
        existing_names = {e.name for e in result.scalars().all()}

        inserted = 0
        for data in SYSTEM_EXERCISES:
            if data["name"] not in existing_names:
                exercise = Exercise(user_id=None, **data)
                session.add(exercise)
                inserted += 1

        if inserted:
            await session.commit()

        return inserted


exercise_service = ExerciseService()
