from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List

# --- Exercises ---
class ExerciseBase(BaseModel):
    name: str = Field(..., max_length=255)
    target_muscle_group: Optional[str] = Field(None, max_length=100)

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseRead(ExerciseBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}

# --- Sets ---
class WorkoutSetBase(BaseModel):
    reps: Optional[int] = Field(None, ge=1)
    weight: Optional[float] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    rest_time_after_seconds: Optional[int] = Field(None, ge=0)

class WorkoutSetCreate(WorkoutSetBase):
    workout_exercise_id: UUID

class WorkoutSetRead(WorkoutSetBase):
    id: UUID
    workout_exercise_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}

# --- Workout Exercises ---
class WorkoutExerciseBase(BaseModel):
    order: int

class WorkoutExerciseCreate(WorkoutExerciseBase):
    exercise_id: UUID

class WorkoutExerciseRead(WorkoutExerciseBase):
    id: UUID
    workout_id: UUID
    exercise_id: UUID
    exercise: Optional[ExerciseRead] = None
    sets: List[WorkoutSetRead] = []

    model_config = {"from_attributes": True}

# --- Workouts ---
class WorkoutBase(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: str = Field(default="planned", max_length=20)
    notes: Optional[str] = None

class WorkoutCreate(WorkoutBase):
    pass

class WorkoutUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None

class WorkoutRead(WorkoutBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class WorkoutReadWithDetails(WorkoutRead):
    workout_exercises: List[WorkoutExerciseRead] = []
