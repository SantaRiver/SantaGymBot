# Exercise Catalog Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement tiered exercise visibility model (system/private), user custom exercise creation, and fuzzy deduplication at write time.

**Architecture:** Add `visibility` + `name_normalized` + `canonical_id` columns to the existing `exercises` table via Alembic migration; enable `pg_trgm` for trigram fuzzy search. Backend gains a `GET /exercises/similar` dedup endpoint and `POST /exercises/` create endpoint. Frontend gains an exercise creation modal with duplicate suggestions shown before creating.

**Tech Stack:** PostgreSQL 16 (pg_trgm), SQLAlchemy 2.0 async, FastAPI, Alembic, React + TypeScript, Zustand, Axios.

---

## MVP Scope Decisions

**Implemented now:**
- `visibility` column: `system` | `private` (schema prepared for future `public`)
- `name_normalized` column + pg_trgm index
- `canonical_id` nullable FK (schema only — no linking logic until public catalog)
- Backfill migration for existing rows
- `POST /exercises/` — authenticated custom exercise creation
- `GET /exercises/similar` — fuzzy dedup search endpoint
- Updated exercise list query filtering by visibility
- Frontend: create exercise flow with dedup suggestions

**Deferred (schema-ready but no logic):**
- `visibility = 'public'` approval pipeline (column exists, logic deferred)
- `user_exercise_library` join table (needed when public catalog + bookmarking lands)
- `is_approved` / `flagged_at` moderation columns
- Admin tooling

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/infrastructure/database/migrations/versions/XXXX_exercise_catalog.py` | **Create** | Alembic migration: add columns, enable pg_trgm, backfill, add indexes |
| `backend/app/infrastructure/database/models.py` | **Modify** | Add `visibility`, `name_normalized`, `canonical_id` to `Exercise` |
| `backend/app/domain/schemas/exercise.py` | **Modify** | Add `ExerciseCreateRequest`, `ExerciseSimilarResult`, update `ExerciseRead` |
| `backend/app/infrastructure/database/repositories/workout.py` | **Modify** | Add `ExerciseRepository.search_similar()`, `create_custom()`, update `get_all_available_for_user()` |
| `backend/app/application/services/exercise_service.py` | **Modify** | Add `create_custom_exercise()`, `find_similar()`, update seed to set `visibility='system'` |
| `backend/app/presentation/api_v1/routers/exercises.py` | **Modify** | Add `POST /` and `GET /similar` endpoints |
| `frontend/src/api/exercises.ts` | **Modify** | Add `create()` and `getSimilar()` API calls; add `ExerciseCreate` type |
| `frontend/src/api/workouts.ts` | **Modify** | Add `visibility` field to `ExerciseRead` interface |
| `frontend/src/components/workout/ExerciseCatalogSheet.tsx` | **Modify** | Add "Create custom exercise" entry point; show dedup suggestions modal |
| `frontend/src/components/workout/CreateExerciseModal.tsx` | **Create** | Modal: name input → similarity check → suggestions or confirm create |

---

## Task 1: Alembic Migration — Schema + pg_trgm + Backfill

**Files:**
- Create: `backend/app/infrastructure/database/migrations/versions/XXXX_exercise_catalog.py`

- [ ] **Step 1: Generate the migration file**

```bash
docker compose exec backend alembic revision -m "exercise_catalog_visibility_fuzzy"
```

Expected output: `Generating .../migrations/versions/XXXX_exercise_catalog_visibility_fuzzy.py`

- [ ] **Step 2: Replace the generated file body with the full migration**

Open the newly generated file and replace its `upgrade()` and `downgrade()` with:

```python
"""exercise_catalog_visibility_fuzzy

Revision ID: <generated>
Revises: 0a6ff7377d2a
Create Date: 2026-04-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '<generated>'
down_revision: Union[str, None] = '0a6ff7377d2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable trigram extension for fuzzy search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Add visibility column: 'system' for seeded, 'private' for user-created
    op.add_column('exercises',
        sa.Column('visibility', sa.String(length=20), nullable=False,
                  server_default='system')
    )

    # Add normalized name column for dedup lookups
    op.add_column('exercises',
        sa.Column('name_normalized', sa.Text(), nullable=True)
    )

    # Add canonical_id FK for future dedup linking (nullable, no logic yet)
    op.add_column('exercises',
        sa.Column('canonical_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_exercises_canonical_id',
        'exercises', 'exercises',
        ['canonical_id'], ['id'],
        ondelete='SET NULL'
    )

    # Backfill: existing user_id=NULL rows are system exercises
    op.execute("""
        UPDATE exercises
        SET visibility = 'system'
        WHERE user_id IS NULL
    """)

    # Backfill: existing user-created exercises get 'private'
    op.execute("""
        UPDATE exercises
        SET visibility = 'private'
        WHERE user_id IS NOT NULL
    """)

    # Backfill normalized names for all existing rows
    op.execute("""
        UPDATE exercises
        SET name_normalized = lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
    """)

    # Make name_normalized NOT NULL after backfill
    op.alter_column('exercises', 'name_normalized', nullable=False)

    # GiST trigram index for similarity search (fast % operator)
    op.execute("""
        CREATE INDEX ix_exercises_name_normalized_trgm
        ON exercises
        USING gist (name_normalized gist_trgm_ops)
    """)

    # Regular index for visibility filtering
    op.create_index('ix_exercises_visibility', 'exercises', ['visibility'])


def downgrade() -> None:
    op.drop_index('ix_exercises_visibility', table_name='exercises')
    op.execute("DROP INDEX IF EXISTS ix_exercises_name_normalized_trgm")
    op.drop_constraint('fk_exercises_canonical_id', 'exercises', type_='foreignkey')
    op.drop_column('exercises', 'canonical_id')
    op.drop_column('exercises', 'name_normalized')
    op.drop_column('exercises', 'visibility')
```

- [ ] **Step 3: Apply the migration**

```bash
docker compose exec backend alembic upgrade head
```

Expected output ends with: `Running upgrade 0a6ff7377d2a -> XXXX, exercise_catalog_visibility_fuzzy`

- [ ] **Step 4: Verify columns and index exist**

```bash
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\d exercises"
```

Expected: columns `visibility`, `name_normalized`, `canonical_id` visible. Also verify:

```bash
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT name, visibility, name_normalized FROM exercises LIMIT 5;"
```

Expected: all rows have `visibility = 'system'` and `name_normalized` populated.

- [ ] **Step 5: Commit**

```bash
git add backend/app/infrastructure/database/migrations/versions/
git commit -m "feat(db): add exercise visibility, name_normalized, canonical_id + pg_trgm migration"
```

---

## Task 2: Update SQLAlchemy Model

**Files:**
- Modify: `backend/app/infrastructure/database/models.py`

- [ ] **Step 1: Update the `Exercise` model**

Replace the existing `Exercise` class (lines 23–32) with:

```python
class Exercise(Base, UUIDMixin):
    __tablename__ = "exercises"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    name_normalized: Mapped[str] = mapped_column(Text)
    target_muscle_group: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="system")
    # nullable FK for future catalog dedup linking — no logic yet
    canonical_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship(back_populates="custom_exercises")
    workout_exercises: Mapped[List["WorkoutExercise"]] = relationship(back_populates="exercise")
```

- [ ] **Step 2: Verify the app still imports cleanly**

```bash
docker compose exec backend python -c "from app.infrastructure.database.models import Exercise; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/infrastructure/database/models.py
git commit -m "feat(model): add visibility, name_normalized, canonical_id to Exercise"
```

---

## Task 3: Update Pydantic Schemas

**Files:**
- Modify: `backend/app/domain/schemas/exercise.py`

- [ ] **Step 1: Replace the entire file content**

```python
# backend/app/domain/schemas/exercise.py
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


def _normalize_name(name: str) -> str:
    """Lowercase, collapse whitespace, strip. Mirrors the SQL backfill logic."""
    return re.sub(r'\s+', ' ', name.strip()).lower()


class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    target_muscle_group: Optional[str] = Field(None, max_length=100)

    @field_validator('name')
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('name must not be blank')
        return v.strip()


class ExerciseRead(BaseModel):
    id: UUID
    name: str
    target_muscle_group: Optional[str] = None
    user_id: Optional[UUID] = None
    visibility: str          # 'system' | 'private' (future: 'public')
    created_at: datetime

    model_config = {"from_attributes": True}


class ExerciseSimilar(BaseModel):
    """A candidate match returned by the fuzzy dedup endpoint."""
    id: UUID
    name: str
    target_muscle_group: Optional[str] = None
    visibility: str
    similarity: float


class ExerciseSimilarResponse(BaseModel):
    matches: list[ExerciseSimilar]
```

- [ ] **Step 2: Verify import**

```bash
docker compose exec backend python -c "from app.domain.schemas.exercise import ExerciseCreate, ExerciseRead, ExerciseSimilarResponse; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domain/schemas/exercise.py
git commit -m "feat(schema): add ExerciseCreate validation, ExerciseSimilar, visibility field"
```

---

## Task 4: Update Repository — Fuzzy Search + Create

**Files:**
- Modify: `backend/app/infrastructure/database/repositories/workout.py`

- [ ] **Step 1: Replace the `ExerciseRepository` class** (lines 41–49) with the full updated version:

```python
class ExerciseRepository(BaseRepository[Exercise]):
    def __init__(self):
        super().__init__(Exercise)

    async def get_all_available_for_user(
        self, session: AsyncSession, user_id: UUID
    ) -> List[Exercise]:
        """System exercises + this user's private exercises."""
        stmt = (
            select(Exercise)
            .where(
                (Exercise.visibility == "system") |
                ((Exercise.visibility == "private") & (Exercise.user_id == user_id))
            )
            .order_by(Exercise.name)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def search_similar(
        self,
        session: AsyncSession,
        name_normalized: str,
        user_id: UUID,
        threshold: float = 0.3,
        limit: int = 5,
    ) -> List[dict]:
        """
        Trigram similarity search across system exercises and caller's private exercises.
        Returns dicts with exercise fields + similarity score.
        Threshold 0.3 catches typos and word-order variants without being too greedy.
        """
        stmt = sa_text("""
            SELECT
                id,
                name,
                target_muscle_group,
                visibility,
                similarity(name_normalized, :q) AS score
            FROM exercises
            WHERE
                similarity(name_normalized, :q) >= :threshold
                AND (
                    visibility = 'system'
                    OR (visibility = 'private' AND user_id = :user_id)
                )
            ORDER BY score DESC
            LIMIT :limit
        """).bindparams(
            q=name_normalized,
            threshold=threshold,
            user_id=user_id,
            limit=limit,
        )
        result = await session.execute(stmt)
        return [dict(row._mapping) for row in result.fetchall()]

    async def create_custom(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        name: str,
        name_normalized: str,
        target_muscle_group: Optional[str],
    ) -> Exercise:
        """Create a private user exercise."""
        exercise = Exercise(
            user_id=user_id,
            name=name,
            name_normalized=name_normalized,
            target_muscle_group=target_muscle_group,
            visibility="private",
        )
        session.add(exercise)
        await session.commit()
        await session.refresh(exercise)
        return exercise
```

- [ ] **Step 2: Add the missing imports** at the top of `workout.py` (after existing imports):

```python
from sqlalchemy import select, text as sa_text
from typing import List, Optional
```

Replace the existing `from sqlalchemy import select` with `from sqlalchemy import select, text as sa_text` and ensure `Optional` is imported from `typing`.

- [ ] **Step 3: Verify import**

```bash
docker compose exec backend python -c "from app.infrastructure.database.repositories.workout import exercise_repo; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/infrastructure/database/repositories/workout.py
git commit -m "feat(repo): add search_similar and create_custom to ExerciseRepository"
```

---

## Task 5: Update Service Layer

**Files:**
- Modify: `backend/app/application/services/exercise_service.py`

- [ ] **Step 1: Replace the entire file**

```python
# backend/app/application/services/exercise_service.py
import re
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.infrastructure.database.models import Exercise
from app.infrastructure.database.repositories.workout import exercise_repo
from app.domain.schemas.exercise import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseSimilar,
    ExerciseSimilarResponse,
)


def _normalize(name: str) -> str:
    return re.sub(r'\s+', ' ', name.strip()).lower()


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
    async def get_available_for_user(
        session: AsyncSession, user_id: UUID
    ) -> List[Exercise]:
        """System exercises + user's own private exercises."""
        return await exercise_repo.get_all_available_for_user(session, user_id)

    @staticmethod
    async def find_similar(
        session: AsyncSession,
        name: str,
        user_id: UUID,
    ) -> ExerciseSimilarResponse:
        """
        Normalize the name and run trigram similarity search.
        Returns up to 5 matches above threshold 0.3.
        """
        normalized = _normalize(name)
        rows = await exercise_repo.search_similar(
            session,
            name_normalized=normalized,
            user_id=user_id,
        )
        matches = [
            ExerciseSimilar(
                id=row["id"],
                name=row["name"],
                target_muscle_group=row["target_muscle_group"],
                visibility=row["visibility"],
                similarity=float(row["score"]),
            )
            for row in rows
        ]
        return ExerciseSimilarResponse(matches=matches)

    @staticmethod
    async def create_custom_exercise(
        session: AsyncSession,
        data: ExerciseCreate,
        user_id: UUID,
    ) -> Exercise:
        """Create a private exercise for this user."""
        return await exercise_repo.create_custom(
            session,
            user_id=user_id,
            name=data.name.strip(),
            name_normalized=_normalize(data.name),
            target_muscle_group=data.target_muscle_group,
        )

    @staticmethod
    async def seed_system_exercises(session: AsyncSession) -> int:
        """Idempotent seed. Sets visibility='system' on all seeded exercises."""
        stmt = select(Exercise).where(Exercise.visibility == "system")
        result = await session.execute(stmt)
        existing_names = {e.name for e in result.scalars().all()}

        inserted = 0
        for data in SYSTEM_EXERCISES:
            if data["name"] not in existing_names:
                exercise = Exercise(
                    user_id=None,
                    name=data["name"],
                    name_normalized=_normalize(data["name"]),
                    target_muscle_group=data["target_muscle_group"],
                    visibility="system",
                )
                session.add(exercise)
                inserted += 1

        if inserted:
            await session.commit()

        return inserted


exercise_service = ExerciseService()
```

- [ ] **Step 2: Verify import**

```bash
docker compose exec backend python -c "from app.application.services.exercise_service import exercise_service; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/application/services/exercise_service.py
git commit -m "feat(service): add find_similar, create_custom_exercise; fix seed visibility"
```

---

## Task 6: Update Router — New Endpoints

**Files:**
- Modify: `backend/app/presentation/api_v1/routers/exercises.py`

- [ ] **Step 1: Replace the entire file**

```python
# backend/app/presentation/api_v1/routers/exercises.py
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.database import get_async_session
from app.infrastructure.database.models import User
from app.presentation.api_v1.deps.deps import get_current_user
from app.application.services.exercise_service import exercise_service
from app.domain.schemas.exercise import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseSimilarResponse,
)

router = APIRouter()


@router.get("/", response_model=List[ExerciseRead])
async def get_exercises(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return system exercises + caller's private exercises."""
    return await exercise_service.get_available_for_user(session, current_user.id)


@router.get("/similar", response_model=ExerciseSimilarResponse)
async def get_similar_exercises(
    q: str = Query(..., min_length=1, max_length=255, description="Exercise name to match"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Fuzzy-search for exercises similar to the given name.
    Used by the frontend to show dedup suggestions before creating a new exercise.
    Returns up to 5 matches with similarity scores.
    """
    return await exercise_service.find_similar(session, q, current_user.id)


@router.post("/", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    data: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a private custom exercise for the current user."""
    return await exercise_service.create_custom_exercise(session, data, current_user.id)


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_exercises(
    session: AsyncSession = Depends(get_async_session),
):
    """Idempotent seed of system exercises. Safe to call multiple times."""
    inserted = await exercise_service.seed_system_exercises(session)
    return {"inserted": inserted, "message": f"Seeded {inserted} new exercises"}
```

- [ ] **Step 2: Verify the app starts cleanly**

```bash
docker compose exec backend python -c "from app.main_api import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Smoke-test the similar endpoint via curl** (replace `YOUR_JWT` with a real token from auth)

```bash
curl -s "http://localhost:8000/api/v1/exercises/similar?q=жим%20штанги" \
  -H "Authorization: Bearer YOUR_JWT" | python3 -m json.tool
```

Expected: JSON with `matches` array containing exercises with similarity scores.

- [ ] **Step 4: Commit**

```bash
git add backend/app/presentation/api_v1/routers/exercises.py
git commit -m "feat(router): add POST /exercises/ and GET /exercises/similar endpoints"
```

---

## Task 7: Update Frontend API Types + Client

**Files:**
- Modify: `frontend/src/api/workouts.ts`
- Modify: `frontend/src/api/exercises.ts`

- [ ] **Step 1: Add `visibility` to `ExerciseRead` in `workouts.ts`**

Find this block in `frontend/src/api/workouts.ts`:

```typescript
export interface ExerciseRead {
  id: string;
  name: string;
  target_muscle_group: string | null;
  user_id: string | null;
}
```

Replace with:

```typescript
export interface ExerciseRead {
  id: string;
  name: string;
  target_muscle_group: string | null;
  user_id: string | null;
  visibility: 'system' | 'private';
  created_at: string;
}
```

- [ ] **Step 2: Replace the entire `exercises.ts`**

```typescript
// frontend/src/api/exercises.ts
import apiClient from './client';
import type { ExerciseRead } from './workouts';

export interface ExerciseCreate {
  name: string;
  target_muscle_group?: string | null;
}

export interface ExerciseSimilar {
  id: string;
  name: string;
  target_muscle_group: string | null;
  visibility: 'system' | 'private';
  similarity: number;
}

export interface ExerciseSimilarResponse {
  matches: ExerciseSimilar[];
}

export const exercisesApi = {
  getAll: async (): Promise<ExerciseRead[]> => {
    const res = await apiClient.get('/exercises/');
    return res.data;
  },

  getSimilar: async (name: string): Promise<ExerciseSimilarResponse> => {
    const res = await apiClient.get('/exercises/similar', { params: { q: name } });
    return res.data;
  },

  create: async (data: ExerciseCreate): Promise<ExerciseRead> => {
    const res = await apiClient.post('/exercises/', data);
    return res.data;
  },

  seed: async (): Promise<{ inserted: number; message: string }> => {
    const res = await apiClient.post('/exercises/seed');
    return res.data;
  },
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /path/to/project/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/exercises.ts frontend/src/api/workouts.ts
git commit -m "feat(api): add ExerciseCreate, ExerciseSimilar types; add create/getSimilar API calls"
```

---

## Task 8: Create `CreateExerciseModal` Component

**Files:**
- Create: `frontend/src/components/workout/CreateExerciseModal.tsx`

This modal handles the full create flow: name input → debounced similarity check → show suggestions or allow direct create.

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/components/workout/CreateExerciseModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { exercisesApi } from '../../api/exercises';
import type { ExerciseRead } from '../../api/workouts';
import type { ExerciseSimilar } from '../../api/exercises';

interface CreateExerciseModalProps {
  onCreated: (exercise: ExerciseRead) => void;
  onClose: () => void;
}

const MUSCLE_GROUPS = [
  'Грудь', 'Спина', 'Ноги', 'Плечи', 'Бицепс', 'Трицепс', 'Пресс', 'Кардио'
];

const SIMILARITY_THRESHOLD = 0.4; // only show suggestions for strong matches

export function CreateExerciseModal({ onCreated, onClose }: CreateExerciseModalProps) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [suggestions, setSuggestions] = useState<ExerciseSimilar[]>([]);
  const [suggestionsChecked, setSuggestionsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce similarity search while user types
  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSuggestionsChecked(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await exercisesApi.getSimilar(trimmed);
        const strong = res.matches.filter(m => m.similarity >= SIMILARITY_THRESHOLD);
        setSuggestions(strong);
        setSuggestionsChecked(true);
      } catch {
        // Non-critical: silently skip suggestions on error
        setSuggestions([]);
        setSuggestionsChecked(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    setError(null);
    try {
      const exercise = await exercisesApi.create({
        name: trimmed,
        target_muscle_group: muscleGroup || null,
      });
      onCreated(exercise);
    } catch {
      setError('Не удалось создать упражнение. Попробуйте ещё раз.');
    } finally {
      setCreating(false);
    }
  };

  const hasSuggestions = suggestions.length > 0;
  const nameIsReady = name.trim().length >= 1 && suggestionsChecked && !loading;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40">
      <div className="w-full bg-tg-theme-bg-color rounded-t-2xl px-4 pt-5 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Новое упражнение</h2>
          <button onClick={onClose} className="p-1 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Name input */}
        <label className="text-xs text-tg-theme-hint-color mb-1 block">Название</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Жим Смита"
          className="w-full bg-tg-theme-secondary-bg-color rounded-xl px-4 py-2.5 text-sm focus:outline-none mb-3"
          autoFocus
        />

        {/* Muscle group selector */}
        <label className="text-xs text-tg-theme-hint-color mb-1 block">Группа мышц (необязательно)</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setMuscleGroup(muscleGroup === g ? '' : g)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                muscleGroup === g
                  ? 'bg-tg-theme-button-color text-tg-theme-button-text-color'
                  : 'bg-tg-theme-secondary-bg-color text-tg-theme-text-color'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Similarity suggestions */}
        {hasSuggestions && (
          <div className="mb-4 border border-yellow-400/30 rounded-xl p-3 bg-yellow-400/5">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
              <p className="text-xs font-semibold text-yellow-600">Похожие упражнения уже есть</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    // User picks an existing exercise instead of creating
                    // We convert the suggestion shape to ExerciseRead for the caller
                    onCreated({
                      id: s.id,
                      name: s.name,
                      target_muscle_group: s.target_muscle_group,
                      user_id: null,
                      visibility: s.visibility,
                      created_at: new Date().toISOString(),
                    });
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-tg-theme-secondary-bg-color active:scale-[0.98] transition-transform"
                >
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.target_muscle_group && (
                    <p className="text-xs text-tg-theme-hint-color mt-0.5">{s.target_muscle_group}</p>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-tg-theme-hint-color mt-2">
              Или создайте своё — кнопка ниже.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!nameIsReady || creating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          <Plus className="w-4 h-4" />
          {creating ? 'Создание...' : hasSuggestions ? 'Всё равно создать своё' : 'Создать упражнение'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /path/to/project/frontend && npm run build 2>&1 | grep -E "(error|warning|CreateExerciseModal)" | head -20
```

Expected: no errors mentioning `CreateExerciseModal`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workout/CreateExerciseModal.tsx
git commit -m "feat(ui): add CreateExerciseModal with debounced fuzzy dedup suggestions"
```

---

## Task 9: Integrate Create Flow into `ExerciseCatalogSheet`

**Files:**
- Modify: `frontend/src/components/workout/ExerciseCatalogSheet.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
// frontend/src/components/workout/ExerciseCatalogSheet.tsx
import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { exercisesApi } from '../../api/exercises';
import type { ExerciseRead } from '../../api/workouts';
import { CreateExerciseModal } from './CreateExerciseModal';

interface ExerciseCatalogSheetProps {
  onSelect: (exercise: ExerciseRead) => void;
  onClose: () => void;
}

export function ExerciseCatalogSheet({ onSelect, onClose }: ExerciseCatalogSheetProps) {
  const [exercises, setExercises] = useState<ExerciseRead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    exercisesApi.getAll().then((data) => {
      setExercises(data);
      setLoading(false);
    });
  }, []);

  const handleCreated = (exercise: ExerciseRead) => {
    // Add to local list immediately so it appears without refetch
    setExercises((prev) => {
      const exists = prev.some((e) => e.id === exercise.id);
      return exists ? prev : [exercise, ...prev];
    });
    setShowCreate(false);
    onSelect(exercise);
  };

  const groups = exercises
    .filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.target_muscle_group ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .reduce<Record<string, ExerciseRead[]>>((acc, ex) => {
      const group = ex.target_muscle_group ?? 'Другое';
      if (!acc[group]) acc[group] = [];
      acc[group].push(ex);
      return acc;
    }, {});

  return (
    <>
      <div className="fixed inset-0 z-30 flex flex-col bg-tg-theme-bg-color">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-bold">Выбор упражнения</h2>
          <button onClick={onClose} className="p-2 -mr-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-tg-theme-secondary-bg-color rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          />
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {loading && (
            <p className="text-center text-tg-theme-hint-color mt-8">Загрузка...</p>
          )}
          {!loading && Object.keys(groups).length === 0 && (
            <p className="text-center text-tg-theme-hint-color mt-8">Ничего не найдено</p>
          )}
          {Object.entries(groups).map(([group, exList]) => (
            <div key={group} className="mb-4">
              <p className="text-xs font-semibold text-tg-theme-hint-color uppercase tracking-wide mb-2">
                {group}
              </p>
              {exList.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-tg-theme-secondary-bg-color mb-1.5 active:scale-[0.98] transition-transform"
                >
                  <p className="font-medium text-sm">{ex.name}</p>
                  {ex.visibility === 'private' && (
                    <p className="text-xs text-tg-theme-hint-color mt-0.5">Моё упражнение</p>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Create new exercise button — sticky at bottom */}
        <div className="px-4 py-3 border-t border-tg-theme-secondary-bg-color">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-tg-theme-secondary-bg-color text-tg-theme-text-color font-medium text-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Создать своё упражнение
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateExerciseModal
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /path/to/project/frontend && npm run build 2>&1 | tail -10
```

Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workout/ExerciseCatalogSheet.tsx
git commit -m "feat(ui): integrate CreateExerciseModal into ExerciseCatalogSheet with optimistic update"
```

---

## Task 10: End-to-End Smoke Test

- [ ] **Step 1: Rebuild and start the full stack**

```bash
docker compose up -d --build
```

Wait for healthy status:

```bash
docker compose ps
```

Expected: all services `healthy` or `Up`.

- [ ] **Step 2: Apply migrations (idempotent)**

```bash
docker compose exec backend alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ...` or `INFO  [alembic.runtime.migration] No new migrations to apply`. No errors.

- [ ] **Step 3: Verify fuzzy search returns results**

Obtain a JWT token first (via `POST /api/v1/auth/` with Telegram initData or dev bypass). Then:

```bash
curl -s "https://api.gym.santariver.lol/api/v1/exercises/similar?q=жим" \
  -H "Authorization: Bearer <YOUR_JWT>" | python3 -m json.tool
```

Expected: `{"matches": [...]}` with multiple exercises containing `жим` in their normalized name.

- [ ] **Step 4: Create a custom exercise and verify it appears**

```bash
curl -s -X POST "https://api.gym.santariver.lol/api/v1/exercises/" \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Тестовое упражнение", "target_muscle_group": "Пресс"}' | python3 -m json.tool
```

Expected: JSON with `"visibility": "private"`, `"user_id": "<your_user_id>"`.

- [ ] **Step 5: Verify custom exercise appears in GET /exercises/**

```bash
curl -s "https://api.gym.santariver.lol/api/v1/exercises/" \
  -H "Authorization: Bearer <YOUR_JWT>" | python3 -m json.tool | grep -A3 "Тестовое"
```

Expected: the newly created exercise is present in the list.

- [ ] **Step 6: Verify custom exercise is NOT visible to another user**

Use a different Telegram account / dev user, get their JWT, and confirm `GET /exercises/` does not return the exercise from Step 4.

- [ ] **Step 7: Final commit tag**

```bash
git tag -a v0.2.0-exercise-catalog -m "Exercise catalog: visibility model + fuzzy dedup + custom exercises"
git push origin main --tags
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| `visibility` column (system/private), schema for future public | Task 1, 2 |
| `name_normalized` + pg_trgm index | Task 1 |
| `canonical_id` schema preparation | Task 1, 2 |
| Backfill existing rows | Task 1 |
| `GET /exercises/` returns system + user private | Task 5, 6 |
| `GET /exercises/similar` fuzzy dedup endpoint | Task 4, 5, 6 |
| `POST /exercises/` create private exercise | Task 4, 5, 6 |
| Updated `ExerciseRead` schema with `visibility` | Task 3, 7 |
| Frontend: type definitions | Task 7 |
| Frontend: `CreateExerciseModal` with dedup suggestions | Task 8 |
| Frontend: integration in `ExerciseCatalogSheet` | Task 9 |
| E2E verification | Task 10 |

**Placeholder scan:** None found. All steps contain concrete code or commands.

**Type consistency check:**
- `ExerciseSimilar` defined in Task 3 (Python) and Task 7 (TypeScript) — field names match.
- `_normalize()` defined in Task 3 and used in Tasks 4, 5 — consistent.
- `search_similar()` returns `List[dict]` in Task 4, consumed as `row["id"]` etc. in Task 5 — consistent.
- `ExerciseRead.visibility` added in Task 3, reflected in TypeScript `workouts.ts` in Task 7 — consistent.
- `CreateExerciseModal.onCreated` receives `ExerciseRead` — Task 8 constructs a valid `ExerciseRead` from `ExerciseSimilar` when user picks a suggestion.
