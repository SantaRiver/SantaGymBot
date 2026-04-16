import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkoutStore } from '../store/workout';
import { useWorkoutDetail } from '../hooks/useWorkoutDetail';
import { useWorkoutPermissions } from '../hooks/useWorkoutPermissions';
import type { WorkoutMode } from '../hooks/useWorkoutPermissions';
import type { ExerciseRead, WorkoutReadWithDetails } from '../api/workouts';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { ActiveWorkoutControls } from '../components/workout/ActiveWorkoutControls';

interface WorkoutSessionProps {
  mode: WorkoutMode;
}

// ─── Active mode sub-view ────────────────────────────────────────────────────

function ActiveWorkoutSession({ id }: { id: string }) {
  const navigate = useNavigate();
  const {
    activeWorkout,
    loadWorkout,
    finishWorkout,
    addExercise,
    elapsedSeconds,
    tickElapsed,
    tickRest,
    isRestActive,
    isLoading,
  } = useWorkoutStore();

  const permissions = useWorkoutPermissions('active');
  const [finishing, setFinishing] = useState(false);

  // Load workout if not already in store or ID changed
  useEffect(() => {
    if (!activeWorkout || activeWorkout.id !== id) {
      loadWorkout(id);
    }
  }, [id]);

  // Elapsed timer — active mode only
  useEffect(() => {
    const interval = setInterval(tickElapsed, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rest timer — active mode only, only when rest is active
  useEffect(() => {
    if (!isRestActive) return;
    const interval = setInterval(tickRest, 1000);
    return () => clearInterval(interval);
  }, [isRestActive]);

  const handleFinish = async () => {
    setFinishing(true);
    await finishWorkout();
    navigate('/', { replace: true });
  };

  const handleExerciseAdded = async (exercise: ExerciseRead) => {
    await addExercise(exercise.id);
  };

  if (isLoading && !activeWorkout) {
    return <WorkoutSessionLoader />;
  }

  if (!activeWorkout) {
    return <WorkoutSessionError message="Тренировка не найдена" />;
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-32">
      <WorkoutHeader
        mode="active"
        elapsedSeconds={elapsedSeconds}
        onFinish={handleFinish}
        finishing={finishing}
      />

      <ExerciseList workout={activeWorkout} canAddSet={permissions.canAddSet} />

      <ActiveWorkoutControls onExerciseAdded={handleExerciseAdded} />
    </div>
  );
}

// ─── History mode sub-view ───────────────────────────────────────────────────

function HistoryWorkoutSession({ id }: { id: string }) {
  const navigate = useNavigate();
  const { workout, isLoading, error } = useWorkoutDetail(id);
  const permissions = useWorkoutPermissions('history');

  if (isLoading) {
    return <WorkoutSessionLoader />;
  }

  if (error || !workout) {
    return <WorkoutSessionError message={error ?? 'Тренировка не найдена'} />;
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-32">
      <WorkoutHeader
        mode="history"
        workout={workout}
        onBack={() => navigate('/', { replace: true })}
      />

      <ExerciseList workout={workout} canAddSet={permissions.canAddSet} />
    </div>
  );
}

// ─── Shared presentational components ───────────────────────────────────────

function ExerciseList({
  workout,
  canAddSet,
}: {
  workout: WorkoutReadWithDetails;
  canAddSet: boolean;
}) {
  if (workout.workout_exercises.length === 0) {
    return (
      <div className="text-center py-12 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-tg-theme-hint-color/30 mb-4">
        <p className="text-tg-theme-hint-color text-sm">Упражнения не добавлены</p>
      </div>
    );
  }

  return (
    <>
      {workout.workout_exercises.map((we) => (
        <ExerciseCard key={we.id} workoutExercise={we} canAddSet={canAddSet} />
      ))}
    </>
  );
}

function WorkoutSessionLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-tg-theme-hint-color">Загрузка...</p>
    </div>
  );
}

function WorkoutSessionError({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center gap-4">
      <p className="text-red-500 font-medium">{message}</p>
      <button
        onClick={() => navigate('/', { replace: true })}
        className="text-tg-theme-button-color text-sm underline"
      >
        Вернуться на главную
      </button>
    </div>
  );
}

// ─── Entry point — routes to correct sub-view by mode ───────────────────────

export default function WorkoutSession({ mode }: WorkoutSessionProps) {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <WorkoutSessionError message="Неверный URL тренировки" />;
  }

  if (mode === 'active') {
    return <ActiveWorkoutSession id={id} />;
  }

  return <HistoryWorkoutSession id={id} />;
}
