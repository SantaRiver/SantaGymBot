import { useState } from 'react';
import { Plus } from 'lucide-react';
import { RestTimer } from './RestTimer';
import { ExerciseCatalogSheet } from './ExerciseCatalogSheet';
import type { ExerciseRead } from '../../api/workouts';
import { useWorkoutStore } from '../../store/workout';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';

interface ActiveWorkoutControlsProps {
  onExerciseAdded: (exercise: ExerciseRead) => void;
  isManaging?: boolean;
}

export function ActiveWorkoutControls({
  onExerciseAdded,
  isManaging = false,
}: ActiveWorkoutControlsProps) {
  const [showCatalog, setShowCatalog] = useState(false);
  const stopRest = useWorkoutStore((state) => state.stopRest);
  const { isRestActive, restSeconds } = useWorkoutSession();

  const handleSelect = (exercise: ExerciseRead) => {
    setShowCatalog(false);
    onExerciseAdded(exercise);
  };

  return (
    <>
      {isRestActive && <RestTimer seconds={restSeconds} onSkip={stopRest} />}

      {showCatalog && (
        <ExerciseCatalogSheet onSelect={handleSelect} onClose={() => setShowCatalog(false)} />
      )}

      {!isManaging && (
        <div
          className="sticky bottom-0 z-10 mt-4 bg-gradient-to-t from-tg-theme-bg-color from-70% to-transparent pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        >
          <button
            onClick={() => setShowCatalog(true)}
            className="w-full bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
            Добавить упражнение
          </button>
        </div>
      )}
    </>
  );
}
