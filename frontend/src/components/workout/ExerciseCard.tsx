import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkoutExerciseRead } from '../../api/workouts';
import { AddSetRow } from './AddSetRow';

interface ExerciseCardProps {
  workoutExercise: WorkoutExerciseRead;
  canAddSet: boolean;
}

export function ExerciseCard({ workoutExercise, canAddSet }: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [, setRefresh] = useState(0);

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
