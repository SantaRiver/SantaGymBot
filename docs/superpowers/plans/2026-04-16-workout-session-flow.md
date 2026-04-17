# Workout Session Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full workout session flow — from pressing "Старт" on Dashboard to completing a workout — including backend exercises catalog endpoint, seed data, and the complete frontend workout screen.

**Architecture:** Backend gets a new `/exercises` router (following existing pattern: repo → service → router → main_api). Frontend gets `api/workouts.ts` + `api/exercises.ts` API modules, a `store/workout.ts` Zustand store, and a new `pages/WorkoutSession.tsx` page mounted at `/workout/:id`. Dashboard's "Старт" button calls `POST /workouts/` then navigates to that route.

**Tech Stack:** Python/FastAPI (backend), React 19, TypeScript, Zustand 5, axios, react-router-dom 7, Tailwind CSS 4, lucide-react

---

## File Map

### Backend — new/modified files
| File | Action | Purpose |
|---|---|---|
| `backend/app/domain/schemas/exercise.py` | **Create** | Pydantic schemas for Exercise (ExerciseRead, ExerciseCreate) |
| `backend/app/application/services/exercise_service.py` | **Create** | ExerciseService: get catalog, seed system exercises |
| `backend/app/presentation/api_v1/routers/exercises.py` | **Create** | GET /exercises router |
| `backend/app/main_api.py` | **Modify** | Register exercises router |

### Frontend — new/modified files
| File | Action | Purpose |
|---|---|---|
| `frontend/src/api/workouts.ts` | **Create** | API functions for workouts CRUD |
| `frontend/src/api/exercises.ts` | **Create** | API function for exercises catalog |
| `frontend/src/store/workout.ts` | **Create** | Zustand store: active workout state, timers |
| `frontend/src/pages/WorkoutSession.tsx` | **Create** | Full workout session screen |
| `frontend/src/App.tsx` | **Modify** | Add `/workout/:id` route |
| `frontend/src/pages/Dashboard.tsx` | **Modify** | Wire "Старт" button: create workout → navigate |

---

## Task 1: Backend — Exercise schemas

**Files:**
- Create: `backend/app/domain/schemas/exercise.py`

- [ ] **Step 1: Create `exercise.py` schemas**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/domain/schemas/exercise.py
git commit -m "feat(back): add Exercise Pydantic schemas"
```

---

## Task 2: Backend — ExerciseService with seed

**Files:**
- Create: `backend/app/application/services/exercise_service.py`

- [ ] **Step 1: Create the service**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/application/services/exercise_service.py
git commit -m "feat(back): add ExerciseService with idempotent seed"
```

---

## Task 3: Backend — exercises router

**Files:**
- Create: `backend/app/presentation/api_v1/routers/exercises.py`
- Modify: `backend/app/main_api.py`

- [ ] **Step 1: Create exercises router**

```python
# backend/app/presentation/api_v1/routers/exercises.py
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.database import get_async_session
from app.infrastructure.database.models import User
from app.presentation.api_v1.deps.deps import get_current_user
from app.application.services.exercise_service import exercise_service
from app.domain.schemas.exercise import ExerciseRead

router = APIRouter()


@router.get("/", response_model=List[ExerciseRead])
async def get_exercises(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return system exercises + user's custom exercises."""
    return await exercise_service.get_available_for_user(session, current_user.id)


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_exercises(
    session: AsyncSession = Depends(get_async_session),
):
    """Idempotent seed of system exercises. Safe to call multiple times."""
    inserted = await exercise_service.seed_system_exercises(session)
    return {"inserted": inserted, "message": f"Seeded {inserted} new exercises"}
```

- [ ] **Step 2: Register router in main_api.py**

Open `backend/app/main_api.py` and add after the existing router imports/includes:

```python
from app.presentation.api_v1.routers.exercises import router as exercises_router

app.include_router(exercises_router, prefix="/api/v1/exercises", tags=["Exercises"])
```

Full updated `main_api.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title="SantaGym WebApp API",
    version="0.1.0",
    description="Backend API for Telegram WebApp Gym Tracker"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "environment": "production" if not settings.DEBUG else "development"}

from app.presentation.api_v1.routers.auth import router as auth_router
from app.presentation.api_v1.routers.workouts import router as workouts_router
from app.presentation.api_v1.routers.exercises import router as exercises_router

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(workouts_router, prefix="/api/v1/workouts", tags=["Workouts"])
app.include_router(exercises_router, prefix="/api/v1/exercises", tags=["Exercises"])
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/presentation/api_v1/routers/exercises.py backend/app/main_api.py
git commit -m "feat(back): add GET /exercises and POST /exercises/seed endpoints"
```

---

## Task 4: Frontend — API modules

**Files:**
- Create: `frontend/src/api/workouts.ts`
- Create: `frontend/src/api/exercises.ts`

- [ ] **Step 1: Create `api/workouts.ts`**

```typescript
// frontend/src/api/workouts.ts
import apiClient from './client';

export interface WorkoutRead {
  id: string;
  user_id: string;
  name: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSetRead {
  id: string;
  workout_exercise_id: string;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  rest_time_after_seconds: number | null;
  created_at: string;
}

export interface ExerciseRead {
  id: string;
  name: string;
  target_muscle_group: string | null;
  user_id: string | null;
}

export interface WorkoutExerciseRead {
  id: string;
  workout_id: string;
  exercise_id: string;
  order: number;
  exercise: ExerciseRead | null;
  sets: WorkoutSetRead[];
}

export interface WorkoutReadWithDetails extends WorkoutRead {
  workout_exercises: WorkoutExerciseRead[];
}

export const workoutsApi = {
  create: async (data: { name?: string; status?: string; start_time?: string }): Promise<WorkoutRead> => {
    const res = await apiClient.post('/workouts/', data);
    return res.data;
  },

  getAll: async (): Promise<WorkoutReadWithDetails[]> => {
    const res = await apiClient.get('/workouts/');
    return res.data;
  },

  getById: async (id: string): Promise<WorkoutReadWithDetails> => {
    const res = await apiClient.get(`/workouts/${id}`);
    return res.data;
  },

  update: async (id: string, data: { status?: string; end_time?: string; name?: string; notes?: string }): Promise<WorkoutRead> => {
    const res = await apiClient.patch(`/workouts/${id}`, data);
    return res.data;
  },

  addExercise: async (workoutId: string, data: { exercise_id: string; order: number }): Promise<WorkoutExerciseRead> => {
    const res = await apiClient.post(`/workouts/${workoutId}/exercises`, data);
    return res.data;
  },

  addSet: async (workoutExerciseId: string, data: { reps?: number; weight?: number; duration_seconds?: number; rest_time_after_seconds?: number; workout_exercise_id: string }): Promise<WorkoutSetRead> => {
    const res = await apiClient.post(`/workouts/exercises/${workoutExerciseId}/sets`, data);
    return res.data;
  },
};
```

- [ ] **Step 2: Create `api/exercises.ts`**

```typescript
// frontend/src/api/exercises.ts
import apiClient from './client';
import type { ExerciseRead } from './workouts';

export const exercisesApi = {
  getAll: async (): Promise<ExerciseRead[]> => {
    const res = await apiClient.get('/exercises/');
    return res.data;
  },

  seed: async (): Promise<{ inserted: number; message: string }> => {
    const res = await apiClient.post('/exercises/seed');
    return res.data;
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/workouts.ts frontend/src/api/exercises.ts
git commit -m "feat(front): add workouts and exercises API modules"
```

---

## Task 5: Frontend — Workout Zustand store

**Files:**
- Create: `frontend/src/store/workout.ts`

- [ ] **Step 1: Create `store/workout.ts`**

```typescript
// frontend/src/store/workout.ts
import { create } from 'zustand';
import { workoutsApi, WorkoutReadWithDetails, WorkoutExerciseRead, WorkoutSetRead } from '../api/workouts';

interface WorkoutState {
  activeWorkout: WorkoutReadWithDetails | null;
  isLoading: boolean;
  error: string | null;

  // Timers (seconds, managed locally — not persisted to backend until finish)
  elapsedSeconds: number;
  restSeconds: number;
  isRestActive: boolean;

  // Actions
  startWorkout: () => Promise<string>; // returns workout id
  loadWorkout: (id: string) => Promise<void>;
  finishWorkout: () => Promise<void>;

  addExercise: (exerciseId: string) => Promise<void>;
  addSet: (workoutExerciseId: string, reps: number | null, weight: number | null) => Promise<void>;

  tickElapsed: () => void;
  tickRest: () => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;

  reset: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeWorkout: null,
  isLoading: false,
  error: null,
  elapsedSeconds: 0,
  restSeconds: 0,
  isRestActive: false,

  startWorkout: async () => {
    set({ isLoading: true, error: null });
    try {
      const workout = await workoutsApi.create({
        status: 'in_progress',
        start_time: new Date().toISOString(),
      });
      // Load with full details
      const detailed = await workoutsApi.getById(workout.id);
      set({ activeWorkout: detailed, isLoading: false, elapsedSeconds: 0 });
      return workout.id;
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  loadWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workout = await workoutsApi.getById(id);
      set({ activeWorkout: workout, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  finishWorkout: async () => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    set({ isLoading: true });
    try {
      await workoutsApi.update(activeWorkout.id, {
        status: 'completed',
        end_time: new Date().toISOString(),
      });
      set({ activeWorkout: null, isLoading: false, elapsedSeconds: 0, isRestActive: false, restSeconds: 0 });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  addExercise: async (exerciseId: string) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const order = activeWorkout.workout_exercises.length + 1;
    const newExercise = await workoutsApi.addExercise(activeWorkout.id, { exercise_id: exerciseId, order });
    set({
      activeWorkout: {
        ...activeWorkout,
        workout_exercises: [...activeWorkout.workout_exercises, newExercise],
      },
    });
  },

  addSet: async (workoutExerciseId: string, reps: number | null, weight: number | null) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const newSet = await workoutsApi.addSet(workoutExerciseId, {
      workout_exercise_id: workoutExerciseId,
      reps: reps ?? undefined,
      weight: weight ?? undefined,
    });
    set({
      activeWorkout: {
        ...activeWorkout,
        workout_exercises: activeWorkout.workout_exercises.map((we) =>
          we.id === workoutExerciseId
            ? { ...we, sets: [...we.sets, newSet] }
            : we
        ),
      },
    });
  },

  tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
  tickRest: () =>
    set((s) => {
      if (s.restSeconds <= 1) return { restSeconds: 0, isRestActive: false };
      return { restSeconds: s.restSeconds - 1 };
    }),
  startRest: (seconds = 90) => set({ isRestActive: true, restSeconds: seconds }),
  stopRest: () => set({ isRestActive: false, restSeconds: 0 }),

  reset: () => set({ activeWorkout: null, elapsedSeconds: 0, restSeconds: 0, isRestActive: false, error: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/workout.ts
git commit -m "feat(front): add workout Zustand store with timers"
```

---

## Task 6: Frontend — WorkoutSession page

**Files:**
- Create: `frontend/src/pages/WorkoutSession.tsx`

- [ ] **Step 1: Create `WorkoutSession.tsx`**

```tsx
// frontend/src/pages/WorkoutSession.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Plus, StopCircle, Timer, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkoutStore } from '../store/workout';
import { exercisesApi } from '../api/exercises';
import type { ExerciseRead } from '../api/workouts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RestTimer({ seconds, onSkip }: { seconds: number; onSkip: () => void }) {
  return (
    <div className="fixed bottom-24 left-4 right-4 bg-tg-theme-secondary-bg-color rounded-2xl p-4 shadow-lg flex items-center justify-between z-20">
      <div>
        <p className="text-xs text-tg-theme-hint-color mb-1">Отдых</p>
        <p className="text-3xl font-bold tabular-nums text-tg-theme-button-color">{formatTime(seconds)}</p>
      </div>
      <button
        onClick={onSkip}
        className="bg-tg-theme-button-color text-tg-theme-button-text-color px-5 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
      >
        Пропустить
      </button>
    </div>
  );
}

interface AddSetRowProps {
  workoutExerciseId: string;
  setCount: number;
  onAdded: () => void;
}

function AddSetRow({ workoutExerciseId, setCount, onAdded }: AddSetRowProps) {
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const { addSet, startRest } = useWorkoutStore();

  const handleSave = async () => {
    const repsNum = reps !== '' ? parseInt(reps, 10) : null;
    const weightNum = weight !== '' ? parseFloat(weight) : null;
    await addSet(workoutExerciseId, repsNum, weightNum);
    startRest(90);
    setReps('');
    setWeight('');
    onAdded();
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-tg-theme-hint-color w-5 text-center">{setCount + 1}</span>
      <input
        type="number"
        inputMode="numeric"
        placeholder="повт."
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        className="w-full rounded-lg bg-tg-theme-bg-color border border-tg-theme-hint-color/20 px-3 py-2 text-sm text-center focus:outline-none focus:border-tg-theme-button-color"
      />
      <input
        type="number"
        inputMode="decimal"
        placeholder="кг"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="w-full rounded-lg bg-tg-theme-bg-color border border-tg-theme-hint-color/20 px-3 py-2 text-sm text-center focus:outline-none focus:border-tg-theme-button-color"
      />
      <button
        onClick={handleSave}
        disabled={reps === '' && weight === ''}
        className="flex-shrink-0 bg-tg-theme-button-color text-tg-theme-button-text-color rounded-lg p-2 disabled:opacity-40 active:scale-95 transition-transform"
      >
        <CheckCircle className="w-5 h-5" />
      </button>
    </div>
  );
}

interface ExerciseCardProps {
  workoutExercise: NonNullable<ReturnType<typeof useWorkoutStore.getState>['activeWorkout']>['workout_exercises'][number];
}

function ExerciseCard({ workoutExercise }: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-4 mb-3">
      <button
        className="flex justify-between items-center w-full"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="text-left">
          <p className="font-semibold">{workoutExercise.exercise?.name ?? 'Упражнение'}</p>
          {workoutExercise.exercise?.target_muscle_group && (
            <p className="text-xs text-tg-theme-hint-color">{workoutExercise.exercise.target_muscle_group}</p>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-tg-theme-hint-color" /> : <ChevronUp className="w-4 h-4 text-tg-theme-hint-color" />}
      </button>

      {!collapsed && (
        <div className="mt-3">
          {/* Header row */}
          {workoutExercise.sets.length > 0 && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="w-5" />
              <span className="w-full text-center text-xs text-tg-theme-hint-color">Повт.</span>
              <span className="w-full text-center text-xs text-tg-theme-hint-color">Кг</span>
              <span className="flex-shrink-0 w-9" />
            </div>
          )}

          {/* Saved sets */}
          {workoutExercise.sets.map((set, i) => (
            <div key={set.id} className="flex items-center gap-2 py-1 border-b border-tg-theme-hint-color/10 last:border-0">
              <span className="text-xs text-tg-theme-hint-color w-5 text-center">{i + 1}</span>
              <span className="w-full text-center text-sm">{set.reps ?? '—'}</span>
              <span className="w-full text-center text-sm">{set.weight !== null ? set.weight : '—'}</span>
              <span className="flex-shrink-0 w-9 flex justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </span>
            </div>
          ))}

          {/* Add set row */}
          <AddSetRow
            workoutExerciseId={workoutExercise.id}
            setCount={workoutExercise.sets.length}
            onAdded={() => setRefresh((r) => r + 1)}
          />
        </div>
      )}
    </div>
  );
}

interface ExerciseCatalogSheetProps {
  onSelect: (exercise: ExerciseRead) => void;
  onClose: () => void;
}

function ExerciseCatalogSheet({ onSelect, onClose }: ExerciseCatalogSheetProps) {
  const [exercises, setExercises] = useState<ExerciseRead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    exercisesApi.getAll().then((data) => {
      setExercises(data);
      setLoading(false);
    });
  }, []);

  const groups = exercises
    .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || (e.target_muscle_group ?? '').toLowerCase().includes(search.toLowerCase()))
    .reduce<Record<string, ExerciseRead[]>>((acc, ex) => {
      const group = ex.target_muscle_group ?? 'Другое';
      if (!acc[group]) acc[group] = [];
      acc[group].push(ex);
      return acc;
    }, {});

  return (
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

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading && <p className="text-center text-tg-theme-hint-color mt-8">Загрузка...</p>}
        {!loading && Object.keys(groups).length === 0 && (
          <p className="text-center text-tg-theme-hint-color mt-8">Ничего не найдено</p>
        )}
        {Object.entries(groups).map(([group, exList]) => (
          <div key={group} className="mb-4">
            <p className="text-xs font-semibold text-tg-theme-hint-color uppercase tracking-wide mb-2">{group}</p>
            {exList.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full text-left px-4 py-3 rounded-xl bg-tg-theme-secondary-bg-color mb-1.5 active:scale-[0.98] transition-transform"
              >
                <p className="font-medium text-sm">{ex.name}</p>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkoutSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    activeWorkout,
    loadWorkout,
    finishWorkout,
    addExercise,
    elapsedSeconds,
    restSeconds,
    isRestActive,
    tickElapsed,
    tickRest,
    stopRest,
    isLoading,
  } = useWorkoutStore();

  const [showCatalog, setShowCatalog] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Load workout on mount if not already in store
  useEffect(() => {
    if (id && (!activeWorkout || activeWorkout.id !== id)) {
      loadWorkout(id);
    }
  }, [id]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(tickElapsed, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rest timer
  useEffect(() => {
    if (!isRestActive) return;
    const interval = setInterval(tickRest, 1000);
    return () => clearInterval(interval);
  }, [isRestActive]);

  const handleSelectExercise = async (exercise: ExerciseRead) => {
    setShowCatalog(false);
    await addExercise(exercise.id);
  };

  const handleFinish = async () => {
    setFinishing(true);
    await finishWorkout();
    navigate('/', { replace: true });
  };

  if (isLoading && !activeWorkout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-tg-theme-hint-color">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-32">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-xl font-bold">Тренировка</h1>
          <p className="text-tg-theme-hint-color text-sm flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            {formatTime(elapsedSeconds)}
          </p>
        </div>
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          <StopCircle className="w-4 h-4" />
          Завершить
        </button>
      </header>

      {/* Exercise list */}
      {activeWorkout?.workout_exercises.length === 0 && (
        <div className="text-center py-12 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-tg-theme-hint-color/30 mb-4">
          <p className="text-tg-theme-hint-color text-sm">Добавь первое упражнение</p>
        </div>
      )}

      {activeWorkout?.workout_exercises.map((we) => (
        <ExerciseCard key={we.id} workoutExercise={we} />
      ))}

      {/* Rest timer overlay */}
      {isRestActive && <RestTimer seconds={restSeconds} onSkip={stopRest} />}

      {/* Exercise catalog fullscreen sheet */}
      {showCatalog && (
        <ExerciseCatalogSheet
          onSelect={handleSelectExercise}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {/* Sticky add exercise button */}
      <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto">
        <button
          onClick={() => setShowCatalog(true)}
          className="w-full bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          Добавить упражнение
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/WorkoutSession.tsx
git commit -m "feat(front): add WorkoutSession page with exercise/set tracking and timers"
```

---

## Task 7: Frontend — Wire routing and Dashboard button

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Update `App.tsx` to add `/workout/:id` route**

```tsx
// frontend/src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Dashboard from './pages/Dashboard'
import WorkoutSession from './pages/WorkoutSession'
import { Dumbbell } from 'lucide-react'

const FullScreenLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-tg-theme-bg-color">
    <Dumbbell className="w-12 h-12 text-tg-theme-button-color animate-pulse mb-4" />
    <div className="text-tg-theme-text-color font-medium">Загрузка дневника...</div>
  </div>
);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, token } = useAuthStore();
  return (user && token) ? children : <Navigate to="/" replace />;
}

function App() {
  const { token, isLoading, authenticate, error } = useAuthStore();

  useEffect(() => {
    if (!token) {
      authenticate();
    }
  }, [token, authenticate]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (error && !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2">Ошибка авторизации</h2>
        <p className="text-tg-theme-hint-color">{error}</p>
        <button
          onClick={() => authenticate()}
          className="mt-6 bg-tg-theme-button-color text-tg-theme-button-text-color px-4 py-2 rounded-lg"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/workout/:id" element={<RequireAuth><WorkoutSession /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App
```

- [ ] **Step 2: Update `Dashboard.tsx` — wire "Старт" button**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useWorkoutStore } from '../store/workout';
import { Dumbbell } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { startWorkout } = useWorkoutStore();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const workoutId = await startWorkout();
      navigate(`/workout/${workoutId}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold">Привет, {user?.username || 'Спортсмен'}! 👋</h1>
          <p className="text-tg-theme-hint-color text-sm">Готов к новой тренировке?</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-tg-theme-secondary-bg-color flex items-center justify-center text-tg-theme-button-color font-bold shadow-md">
          {user?.username?.charAt(0).toUpperCase() || 'S'}
        </div>
      </header>

      <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm mb-6 border border-gray-100 dark:border-gray-800">
        <Dumbbell className="w-16 h-16 text-tg-theme-button-color mb-4" />
        <h2 className="text-xl font-bold mb-2">Начать тренировку</h2>
        <p className="text-sm text-tg-theme-hint-color mb-6">Отслеживай свои подходы и прогресс</p>

        <button
          onClick={handleStart}
          disabled={starting}
          className="bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold py-4 px-8 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg shadow-tg-theme-button-color/30 active:scale-95 transition-transform disabled:opacity-60"
        >
          <Dumbbell className="w-5 h-5" />
          {starting ? 'Создаём...' : 'Старт'}
        </button>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-4">История тренировок</h3>
        <div className="text-center py-10 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-tg-theme-hint-color/30">
          <p className="text-tg-theme-hint-color text-sm">У вас пока нет ни одной тренировки.</p>
        </div>
      </div>

      <button
        onClick={logout}
        className="mt-12 w-full text-center text-red-500 text-sm opacity-50"
      >
        Сбросить сессию (dev)
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(front): wire Start button and add /workout/:id route"
```

---

## Task 8: Seed exercises via API call on first load

This ensures the exercises catalog is populated when the app is first used.

**Files:**
- Modify: `frontend/src/store/workout.ts` — add `ensureExercisesCatalog` call on app start

The cleanest approach for a Telegram Mini App: call `POST /exercises/seed` once from `App.tsx` after successful auth. It's idempotent, so safe to call every session.

- [ ] **Step 1: Update `App.tsx` to seed exercises after auth**

Add `exercisesApi` seed call inside the existing `useEffect` after `authenticate()` succeeds. Since we can't hook into the store promise easily, instead call seed as a fire-and-forget after auth state is set. Add to `App.tsx`:

```tsx
// frontend/src/App.tsx  — add this import at top
import { exercisesApi } from './api/exercises';

// Inside App(), modify the useEffect:
useEffect(() => {
  if (!token) {
    authenticate();
  } else {
    // Fire-and-forget: seed system exercises if catalog is empty
    exercisesApi.seed().catch(() => {/* silent — catalog may already be populated */});
  }
}, [token, authenticate]);
```

Full updated `App.tsx` after this step:

```tsx
// frontend/src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { exercisesApi } from './api/exercises'
import Dashboard from './pages/Dashboard'
import WorkoutSession from './pages/WorkoutSession'
import { Dumbbell } from 'lucide-react'

const FullScreenLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-tg-theme-bg-color">
    <Dumbbell className="w-12 h-12 text-tg-theme-button-color animate-pulse mb-4" />
    <div className="text-tg-theme-text-color font-medium">Загрузка дневника...</div>
  </div>
);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, token } = useAuthStore();
  return (user && token) ? children : <Navigate to="/" replace />;
}

function App() {
  const { token, isLoading, authenticate, error } = useAuthStore();

  useEffect(() => {
    if (!token) {
      authenticate();
    } else {
      exercisesApi.seed().catch(() => {});
    }
  }, [token, authenticate]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (error && !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2">Ошибка авторизации</h2>
        <p className="text-tg-theme-hint-color">{error}</p>
        <button
          onClick={() => authenticate()}
          className="mt-6 bg-tg-theme-button-color text-tg-theme-button-text-color px-4 py-2 rounded-lg"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/workout/:id" element={<RequireAuth><WorkoutSession /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(front): auto-seed exercises catalog after auth"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| GET /exercises endpoint | Task 3 |
| Idempotent seed with 26 exercises | Task 2 |
| System vs. user-created exercise distinction (user_id=None vs UUID) | Task 1, 2 — `user_id: null` = system |
| "Старт" button creates workout + navigates | Task 7 |
| Workout timer (elapsed) | Task 5 store + Task 6 UI |
| Rest timer after set | Task 5 store + Task 6 UI |
| Add exercise from catalog with search | Task 6 `ExerciseCatalogSheet` |
| Add/log sets (reps + weight) | Task 6 `AddSetRow` + Task 5 `addSet` |
| Finish workout (PATCH status=completed) | Task 5 `finishWorkout` + Task 6 |
| Weight can be negative/zero/positive | `weight: number | null` — no validation constraint on frontend; backend model uses Numeric(5,2) with `ge=0` constraint |

**⚠️ Gap found:** Backend `WorkoutSetBase.weight` has `ge=0` constraint (line 25 of `workout.py`), which prevents negative weight. The requirement says weight can be negative (e.g., assisted exercises). Remove the `ge=0` constraint from `WorkoutSetBase`:

**Additional Task 9 (fix backend weight constraint):**

- [ ] **Step 1: Remove `ge=0` from weight in `backend/app/domain/schemas/workout.py`**

```python
# Change line 25 from:
weight: Optional[float] = Field(None, ge=0)
# To:
weight: Optional[float] = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/domain/schemas/workout.py
git commit -m "fix(back): allow negative weight for assisted/bodyweight exercises"
```

---

**No placeholders found.** All steps contain complete code.

**Type consistency verified:** `ExerciseRead`, `WorkoutExerciseRead`, `WorkoutSetRead`, `WorkoutReadWithDetails` are defined once in `api/workouts.ts` and imported everywhere. Store methods match API function signatures.
