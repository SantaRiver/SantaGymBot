import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorkoutStore } from '../../store/workout';
import { RestTimer } from './RestTimer';
import { ExerciseCatalogSheet } from './ExerciseCatalogSheet';
import type { ExerciseRead } from '../../api/workouts';

interface ActiveWorkoutControlsProps {
  onExerciseAdded: (exercise: ExerciseRead) => Promise<void>;
}

export function ActiveWorkoutControls({ onExerciseAdded }: ActiveWorkoutControlsProps) {
  const [showCatalog, setShowCatalog] = useState(false);
  const { isRestActive, restSeconds, stopRest } = useWorkoutStore();

  const handleSelect = async (exercise: ExerciseRead) => {
    setShowCatalog(false);
    await onExerciseAdded(exercise);
  };

  return (
    <>
      {isRestActive && <RestTimer seconds={restSeconds} onSkip={stopRest} />}

      {showCatalog && (
        <ExerciseCatalogSheet onSelect={handleSelect} onClose={() => setShowCatalog(false)} />
      )}

      <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto">
        <button
          onClick={() => setShowCatalog(true)}
          className="w-full bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          Добавить упражнение
        </button>
      </div>
    </>
  );
}
