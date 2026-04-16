# backend/app/domain/schemas/exercise.py
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class ExerciseCreate(BaseModel):
    name: str = Field(..., max_length=255)
    target_muscle_group: Optional[str] = Field(None, max_length=100)


class ExerciseRead(BaseModel):
    id: UUID
    name: str
    target_muscle_group: Optional[str] = None
    user_id: Optional[UUID] = None  # None = system/global exercise
    created_at: datetime

    model_config = {"from_attributes": True}
