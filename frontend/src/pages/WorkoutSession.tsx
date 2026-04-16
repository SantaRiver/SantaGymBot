import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Plus, StopCircle, Timer, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkoutStore } from '../store/workout';
import { exercisesApi } from '../api/exercises';
import type { ExerciseRead } from '../api/workouts';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

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
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold">Выбор упражнения</h2>
        <button onClick={onClose} className="p-2 -mr-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-tg-theme-secondary-bg-color rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        />
      </div>

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

  useEffect(() => {
    if (id && (!activeWorkout || activeWorkout.id !== id)) {
      loadWorkout(id);
    }
  }, [id]);

  useEffect(() => {
    const interval = setInterval(tickElapsed, 1000);
    return () => clearInterval(interval);
  }, []);

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

      {activeWorkout?.workout_exercises.length === 0 && (
        <div className="text-center py-12 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-tg-theme-hint-color/30 mb-4">
          <p className="text-tg-theme-hint-color text-sm">Добавь первое упражнение</p>
        </div>
      )}

      {activeWorkout?.workout_exercises.map((we) => (
        <ExerciseCard key={we.id} workoutExercise={we} />
      ))}

      {isRestActive && <RestTimer seconds={restSeconds} onSkip={stopRest} />}

      {showCatalog && (
        <ExerciseCatalogSheet
          onSelect={handleSelectExercise}
          onClose={() => setShowCatalog(false)}
        />
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
    </div>
  );
}
