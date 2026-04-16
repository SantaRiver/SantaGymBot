import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import BigInteger, ForeignKey, String, Text, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.database import Base, TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    language_code: Mapped[str] = mapped_column(String(10), default="en")
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    workouts: Mapped[List["Workout"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    custom_exercises: Mapped[List["Exercise"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Exercise(Base, UUIDMixin):
    __tablename__ = "exercises"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    name_normalized: Mapped[str] = mapped_column(Text)
    target_muscle_group: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="system")
    canonical_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship(back_populates="custom_exercises")
    workout_exercises: Mapped[List["WorkoutExercise"]] = relationship(back_populates="exercise")


class Workout(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workouts"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # e.g. "Chest Day"
    start_time: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned") # planned, in_progress, completed
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="workouts")
    workout_exercises: Mapped[List["WorkoutExercise"]] = relationship(back_populates="workout", cascade="all, delete-orphan")


class WorkoutExercise(Base, UUIDMixin):
    __tablename__ = "workout_exercises"

    workout_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workouts.id", ondelete="CASCADE"))
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercises.id", ondelete="RESTRICT"))
    order: Mapped[int] = mapped_column(Integer)

    workout: Mapped["Workout"] = relationship(back_populates="workout_exercises")
    exercise: Mapped["Exercise"] = relationship(back_populates="workout_exercises")
    sets: Mapped[List["WorkoutSet"]] = relationship(back_populates="workout_exercise", cascade="all, delete-orphan")


class WorkoutSet(Base, UUIDMixin):
    __tablename__ = "workout_sets"

    workout_exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workout_exercises.id", ondelete="CASCADE"))
    reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rest_time_after_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    workout_exercise: Mapped["WorkoutExercise"] = relationship(back_populates="sets")
