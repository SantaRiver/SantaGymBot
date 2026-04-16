from datetime import datetime
from typing import Optional
from uuid import UUID
import re

from pydantic import BaseModel, Field, field_validator


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    target_muscle_group: Optional[str] = Field(None, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        normalized = _normalize_name(value)
        if not normalized:
            raise ValueError("name must not be blank")
        return value.strip()


class ExerciseRead(BaseModel):
    id: UUID
    name: str
    target_muscle_group: Optional[str] = None
    user_id: Optional[UUID] = None  # None = system/global exercise
    visibility: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExerciseSimilar(BaseModel):
    id: UUID
    name: str
    target_muscle_group: Optional[str] = None
    visibility: str
    similarity: float


class ExerciseSimilarResponse(BaseModel):
    matches: list[ExerciseSimilar]
