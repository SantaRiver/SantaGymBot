import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useWorkoutStore } from '../../store/workout';

interface AddSetRowProps {
  workoutExerciseId: string;
  setCount: number;
  onAdded: () => void;
}

export function AddSetRow({ workoutExerciseId, setCount, onAdded }: AddSetRowProps) {
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
