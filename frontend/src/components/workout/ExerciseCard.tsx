import { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react';
import type { WorkoutExerciseRead } from '../../api/workouts';
import type {
  WorkoutSessionExercise,
  WorkoutSessionSet,
} from '../../store/workout-session.types';
import { useWorkoutStore } from '../../store/workout';

interface ExerciseCardProps {
  workoutExercise: WorkoutExerciseRead | WorkoutSessionExercise;
  canAddSet: boolean;
  isManaging?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}

const isLocalExercise = (
  exercise: WorkoutExerciseRead | WorkoutSessionExercise,
): exercise is WorkoutSessionExercise => 'localId' in exercise;

function LocalSetRow({
  exerciseLocalId,
  setItem,
  index,
}: {
  exerciseLocalId: string;
  setItem: WorkoutSessionSet;
  index: number;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const updateSetDraft = useWorkoutStore((state) => state.updateSetDraft);
  const commitSet = useWorkoutStore((state) => state.commitSet);

  return (
    <div
      ref={rowRef}
      className="flex items-center gap-2 py-1 border-b border-tg-theme-hint-color/10 last:border-0"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && rowRef.current?.contains(event.relatedTarget)) {
          return;
        }

        commitSet(exerciseLocalId, setItem.localId);
      }}
    >
      <span className="text-xs text-tg-theme-hint-color w-5 text-center">{index + 1}</span>
      <label className="sr-only" htmlFor={`${setItem.localId}-weight`}>
        Вес, подход {index + 1}
      </label>
      <input
        id={`${setItem.localId}-weight`}
        type="number"
        inputMode="decimal"
        placeholder="кг"
        aria-label={`Вес, подход ${index + 1}`}
        value={setItem.weight}
        onChange={(event) =>
          updateSetDraft(exerciseLocalId, setItem.localId, { weight: event.target.value })
        }
        className="w-full rounded-lg bg-tg-theme-bg-color border border-tg-theme-hint-color/20 px-3 py-2 text-base text-center focus:outline-none focus:border-tg-theme-button-color"
      />
      <label className="sr-only" htmlFor={`${setItem.localId}-reps`}>
        Повторения, подход {index + 1}
      </label>
      <input
        id={`${setItem.localId}-reps`}
        type="number"
        inputMode="numeric"
        placeholder="повт."
        aria-label={`Повторения, подход ${index + 1}`}
        value={setItem.reps}
        onChange={(event) =>
          updateSetDraft(exerciseLocalId, setItem.localId, { reps: event.target.value })
        }
        className="w-full rounded-lg bg-tg-theme-bg-color border border-tg-theme-hint-color/20 px-3 py-2 text-base text-center focus:outline-none focus:border-tg-theme-button-color"
      />
    </div>
  );
}

function RemoteSetRow({
  weight,
  reps,
  index,
}: {
  weight: number | null;
  reps: number | null;
  index: number;
}) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-tg-theme-hint-color/10 last:border-0">
      <span className="text-xs text-tg-theme-hint-color w-5 text-center">{index + 1}</span>
      <span className="w-full text-center text-sm">{weight !== null ? weight : '—'}</span>
      <span className="w-full text-center text-sm">{reps ?? '—'}</span>
    </div>
  );
}

export function ExerciseCard({
  workoutExercise,
  canAddSet,
  isManaging = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const addSet = useWorkoutStore((state) => state.addSet);
  const localExercise = isLocalExercise(workoutExercise) ? workoutExercise : null;
  const title = localExercise
    ? workoutExercise.name
    : workoutExercise.exercise?.name ?? 'Упражнение';
  const subtitle = localExercise
    ? workoutExercise.targetMuscleGroup
    : workoutExercise.exercise?.target_muscle_group;
  const setCount = localExercise ? workoutExercise.sets.length : workoutExercise.sets.length;

  if (isManaging) {
    return (
      <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-4 mb-3 border border-tg-theme-hint-color/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-tg-theme-bg-color px-2 text-xs font-semibold text-tg-theme-hint-color">
                {localExercise ? workoutExercise.order : workoutExercise.order}
              </span>
              <p className="font-semibold truncate">{title}</p>
            </div>
            <p className="mt-1 text-xs text-tg-theme-hint-color">
              {subtitle ?? 'Без группы'} · {setCount} подх.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="rounded-xl bg-tg-theme-bg-color p-2 text-tg-theme-text-color disabled:opacity-30"
              aria-label="Переместить выше"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="rounded-xl bg-tg-theme-bg-color p-2 text-tg-theme-text-color disabled:opacity-30"
              aria-label="Переместить ниже"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onClick={onRemove}
              className="rounded-xl bg-red-500/10 p-2 text-red-500"
              aria-label="Удалить упражнение"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-4 mb-3">
      <button
        className="flex justify-between items-center w-full"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        <div className="min-w-0 text-left">
          <p className="font-semibold [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-tg-theme-hint-color">{subtitle}</p>
          )}
          {localExercise?.lastError && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {localExercise.lastError}
            </p>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-tg-theme-hint-color" />
        ) : (
          <ChevronUp className="w-4 h-4 text-tg-theme-hint-color" />
        )}
      </button>

      {!collapsed && (
        <div className="mt-3">
          {setCount > 0 && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="w-5" />
              <span className="w-full text-center text-xs text-tg-theme-hint-color">Кг</span>
              <span className="w-full text-center text-xs text-tg-theme-hint-color">Повт.</span>
            </div>
          )}

          {localExercise
            ? localExercise.sets.map((setItem, index) => (
                <LocalSetRow
                  key={setItem.localId}
                  exerciseLocalId={localExercise.localId}
                  setItem={setItem}
                  index={index}
                />
              ))
            : workoutExercise.sets.map((setItem, index) => (
                <RemoteSetRow
                  key={setItem.id}
                  weight={setItem.weight}
                  reps={setItem.reps}
                  index={index}
                />
              ))}

          {canAddSet && localExercise && (
            <button
              onClick={() => addSet(localExercise.localId)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-tg-theme-bg-color px-4 py-3 text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4" />
              Добавить подход
            </button>
          )}
        </div>
      )}
    </div>
  );
}
