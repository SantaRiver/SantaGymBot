import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkoutStore } from '../store/workout';
import { useWorkoutDetail } from '../hooks/useWorkoutDetail';
import { useWorkoutPermissions } from '../hooks/useWorkoutPermissions';
import type { WorkoutMode } from '../hooks/useWorkoutPermissions';
import type { ExerciseRead, WorkoutExerciseRead, WorkoutReadWithDetails } from '../api/workouts';
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
    removeExercise,
    moveExercise,
    elapsedSeconds,
    tickElapsed,
    tickRest,
    isRestActive,
    isLoading,
    error,
  } = useWorkoutStore();

  const permissions = useWorkoutPermissions('active');
  const [finishing, setFinishing] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [pendingExerciseRemoval, setPendingExerciseRemoval] = useState<WorkoutExerciseRead | null>(null);
  const [busyExerciseId, setBusyExerciseId] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeWorkout && activeWorkout.workout_exercises.length === 0 && isManaging) {
      setIsManaging(false);
    }
  }, [activeWorkout, isManaging]);

  const handleFinish = async () => {
    if (!activeWorkout) return;
    setFinishing(true);
    try {
      await finishWorkout();
      navigate('/', { replace: true });
    } finally {
      setFinishing(false);
    }
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

  const hasExercises = activeWorkout.workout_exercises.length > 0;

  const handleMoveExercise = async (workoutExerciseId: string, direction: 'up' | 'down') => {
    setBusyExerciseId(workoutExerciseId);
    try {
      await moveExercise(workoutExerciseId, direction);
    } finally {
      setBusyExerciseId(null);
    }
  };

  const handleRemoveExercise = async () => {
    if (!pendingExerciseRemoval) return;
    setBusyExerciseId(pendingExerciseRemoval.id);
    try {
      await removeExercise(pendingExerciseRemoval.id);
      setPendingExerciseRemoval(null);
    } finally {
      setBusyExerciseId(null);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-32">
      <WorkoutHeader
        mode="active"
        elapsedSeconds={elapsedSeconds}
        onFinish={handleFinish}
        finishing={finishing}
        canManage={hasExercises}
        isManaging={isManaging}
        onToggleManage={() => setIsManaging((value) => !value)}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <ExerciseList
        workout={activeWorkout}
        canAddSet={permissions.canAddSet}
        isManaging={isManaging}
        busyExerciseId={busyExerciseId}
        onMoveExercise={handleMoveExercise}
        onRemoveExercise={setPendingExerciseRemoval}
      />

      <ActiveWorkoutControls onExerciseAdded={handleExerciseAdded} />

      <ConfirmDialog
        open={pendingExerciseRemoval !== null}
        title="Удалить упражнение?"
        description={
          pendingExerciseRemoval
            ? `Упражнение "${pendingExerciseRemoval.exercise?.name ?? 'Без названия'}" будет удалено вместе со всеми подходами в этой тренировке.`
            : ''
        }
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmTone="danger"
        onCancel={() => setPendingExerciseRemoval(null)}
        onConfirm={handleRemoveExercise}
      />
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
  isManaging = false,
  busyExerciseId = null,
  onMoveExercise,
  onRemoveExercise,
}: {
  workout: WorkoutReadWithDetails;
  canAddSet: boolean;
  isManaging?: boolean;
  busyExerciseId?: string | null;
  onMoveExercise?: (workoutExerciseId: string, direction: 'up' | 'down') => Promise<void>;
  onRemoveExercise?: (workoutExercise: WorkoutExerciseRead) => void;
}) {
  if (workout.workout_exercises.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-tg-theme-hint-color/30 bg-tg-theme-secondary-bg-color/50 px-5 py-8 text-center">
        <p className="text-base font-semibold mb-2">Тренировка пока пустая</p>
        <p className="text-tg-theme-hint-color text-sm">
          Добавьте первое упражнение. Если завершить такую тренировку сейчас, она будет удалена.
        </p>
      </div>
    );
  }

  return (
    <>
      {isManaging && (
        <div className="mb-3 rounded-xl bg-tg-theme-secondary-bg-color/70 px-4 py-3 text-sm text-tg-theme-hint-color">
          Перемещайте упражнения кнопками вверх и вниз. Удаление доступно только через подтверждение.
        </div>
      )}
      {workout.workout_exercises.map((we, index) => (
        <ExerciseCard
          key={we.id}
          workoutExercise={we}
          canAddSet={canAddSet}
          isManaging={isManaging}
          canMoveUp={index > 0}
          canMoveDown={index < workout.workout_exercises.length - 1}
          onMoveUp={onMoveExercise ? () => onMoveExercise(we.id, 'up') : undefined}
          onMoveDown={onMoveExercise ? () => onMoveExercise(we.id, 'down') : undefined}
          onRemove={onRemoveExercise ? () => onRemoveExercise(we) : undefined}
          isBusy={busyExerciseId === we.id}
        />
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

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmTone,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 p-4">
      <div className="w-full max-w-md mx-auto rounded-3xl bg-tg-theme-bg-color p-5 shadow-2xl">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-tg-theme-hint-color mb-5">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-tg-theme-secondary-bg-color px-4 py-3 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => void onConfirm()}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${
              confirmTone === 'danger'
                ? 'bg-red-500 text-white'
                : 'bg-tg-theme-button-color text-tg-theme-button-text-color'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
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
