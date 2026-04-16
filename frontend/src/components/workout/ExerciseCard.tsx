import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { WorkoutExerciseRead } from '../../api/workouts';
import { AddSetRow } from './AddSetRow';

interface ExerciseCardProps {
  workoutExercise: WorkoutExerciseRead;
  canAddSet: boolean;
  isManaging?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  isBusy?: boolean;
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
  isBusy = false,
}: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [, setRefresh] = useState(0);

  if (isManaging) {
    return (
      <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-4 mb-3 border border-tg-theme-hint-color/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-tg-theme-bg-color px-2 text-xs font-semibold text-tg-theme-hint-color">
                {workoutExercise.order}
              </span>
              <p className="font-semibold truncate">{workoutExercise.exercise?.name ?? 'Упражнение'}</p>
            </div>
            <p className="mt-1 text-xs text-tg-theme-hint-color">
              {workoutExercise.exercise?.target_muscle_group ?? 'Без группы'} · {workoutExercise.sets.length} подх.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp || isBusy}
              className="rounded-xl bg-tg-theme-bg-color p-2 text-tg-theme-text-color disabled:opacity-30"
              aria-label="Переместить выше"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown || isBusy}
              className="rounded-xl bg-tg-theme-bg-color p-2 text-tg-theme-text-color disabled:opacity-30"
              aria-label="Переместить ниже"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onClick={onRemove}
              disabled={isBusy}
              className="rounded-xl bg-red-500/10 p-2 text-red-500 disabled:opacity-30"
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
          {workoutExercise.sets.length > 0 && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="w-5" />
              <span className="w-full text-center text-xs text-tg-theme-hint-color">Повт.</span>
              <span className="w-full text-center text-xs text-tg-theme-hint-color">Кг</span>
              <span className="flex-shrink-0 w-9" />
            </div>
          )}

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

          {canAddSet && (
            <AddSetRow
              workoutExerciseId={workoutExercise.id}
              setCount={workoutExercise.sets.length}
              onAdded={() => setRefresh((r) => r + 1)}
            />
          )}
        </div>
      )}
    </div>
  );
}
