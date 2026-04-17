import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkoutStore } from '../store/workout';
import { useWorkoutDetail } from '../hooks/useWorkoutDetail';
import { useWorkoutPermissions } from '../hooks/useWorkoutPermissions';
import type { WorkoutMode } from '../hooks/useWorkoutPermissions';
import type { WorkoutReadWithDetails } from '../api/workouts';
import type { WorkoutSessionExercise } from '../store/workout-session.types';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { ActiveWorkoutControls } from '../components/workout/ActiveWorkoutControls';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { useWorkoutStoreHydration } from '../hooks/useWorkoutStoreHydration';
import { Dialog } from '../components/ui/Dialog';

interface WorkoutSessionProps {
  mode: WorkoutMode;
}

function ActiveWorkoutSession({ id }: { id?: string }) {
  const navigate = useNavigate();
  const {
    exercises,
    elapsedSeconds,
    hasExercises,
    hasSession,
    isLoading,
    error,
  } = useWorkoutSession();
  const { isHydrated } = useWorkoutStoreHydration();
  const restoreWorkout = useWorkoutStore((state) => state.restoreWorkout);
  const finishWorkout = useWorkoutStore((state) => state.finishWorkout);
  const addExercise = useWorkoutStore((state) => state.addExercise);
  const removeExercise = useWorkoutStore((state) => state.removeExercise);
  const moveExercise = useWorkoutStore((state) => state.moveExercise);

  const permissions = useWorkoutPermissions('active');
  const [finishing, setFinishing] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [pendingExerciseRemoval, setPendingExerciseRemoval] = useState<WorkoutSessionExercise | null>(null);

  useEffect(() => {
    if (!id || !isHydrated || hasSession) {
      return;
    }

    void restoreWorkout(id);
  }, [hasSession, id, isHydrated, restoreWorkout]);

  useEffect(() => {
    if (!hasExercises && isManaging) {
      setIsManaging(false);
    }
  }, [hasExercises, isManaging]);

  const handleFinish = async () => {
    setFinishing(true);
    try {
      await finishWorkout();
      navigate('/', { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  if ((!isHydrated && id) || (isLoading && !hasSession && id)) {
    return <WorkoutSessionLoader />;
  }

  if (!hasSession && !id) {
    return <WorkoutSessionError message="Активная тренировка не найдена" />;
  }

  if (!hasSession && id && !isLoading) {
    return <WorkoutSessionError message={error ?? 'Тренировка не найдена'} />;
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-6">
      <WorkoutHeader
        mode="active"
        elapsedSeconds={elapsedSeconds}
        onFinish={handleFinish}
        finishing={finishing}
        canManage={hasExercises}
        isManaging={isManaging}
        onToggleManage={() => setIsManaging((value) => !value)}
      />

      <ExerciseList
        exercises={exercises}
        canAddSet={permissions.canAddSet}
        isManaging={isManaging}
        onMoveExercise={moveExercise}
        onRemoveExercise={setPendingExerciseRemoval}
      />

      <ActiveWorkoutControls
        onExerciseAdded={addExercise}
        isManaging={isManaging}
      />

      <ConfirmDialog
        open={pendingExerciseRemoval !== null}
        title="Удалить упражнение?"
        description={
          pendingExerciseRemoval
            ? `Упражнение "${pendingExerciseRemoval.name}" будет удалено вместе со всеми подходами в этой тренировке.`
            : ''
        }
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmTone="danger"
        onCancel={() => setPendingExerciseRemoval(null)}
        onConfirm={() => {
          if (!pendingExerciseRemoval) {
            return;
          }

          removeExercise(pendingExerciseRemoval.localId);
          setPendingExerciseRemoval(null);
        }}
      />
    </div>
  );
}

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

      <HistoryExerciseList workout={workout} canAddSet={permissions.canAddSet} />
    </div>
  );
}

function ExerciseList({
  exercises,
  canAddSet,
  isManaging = false,
  onMoveExercise,
  onRemoveExercise,
}: {
  exercises: WorkoutSessionExercise[];
  canAddSet: boolean;
  isManaging?: boolean;
  onMoveExercise: (exerciseLocalId: string, direction: 'up' | 'down') => void;
  onRemoveExercise: (exercise: WorkoutSessionExercise) => void;
}) {
  if (exercises.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-tg-theme-hint-color/30 bg-tg-theme-secondary-bg-color/50 px-5 py-8 text-center">
        <p className="text-base font-semibold mb-2">Тренировка пока пустая</p>
        <p className="text-tg-theme-hint-color text-sm">
          Добавьте первое упражнение. Если выйти сейчас, черновик не сохранится.
        </p>
      </div>
    );
  }

  return (
    <>
      {isManaging && (
        <div className="mb-3 rounded-xl bg-tg-theme-secondary-bg-color/70 px-4 py-3 text-sm text-tg-theme-hint-color">
          Перемещайте упражнения кнопками вверх и вниз. Удаление требует подтверждения.
        </div>
      )}
      {exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.localId}
          workoutExercise={exercise}
          canAddSet={canAddSet}
          isManaging={isManaging}
          canMoveUp={index > 0}
          canMoveDown={index < exercises.length - 1}
          onMoveUp={() => onMoveExercise(exercise.localId, 'up')}
          onMoveDown={() => onMoveExercise(exercise.localId, 'down')}
          onRemove={() => onRemoveExercise(exercise)}
        />
      ))}
    </>
  );
}

function HistoryExerciseList({
  workout,
  canAddSet,
}: {
  workout: WorkoutReadWithDetails;
  canAddSet: boolean;
}) {
  if (workout.workout_exercises.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-tg-theme-hint-color/30 bg-tg-theme-secondary-bg-color/50 px-5 py-8 text-center">
        <p className="text-base font-semibold mb-2">Тренировка была пустой</p>
      </div>
    );
  }

  return (
    <>
      {workout.workout_exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          workoutExercise={exercise}
          canAddSet={canAddSet}
        />
      ))}
    </>
  );
}

function WorkoutSessionLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-base font-semibold">Загружаем тренировку</p>
      <p className="text-sm text-tg-theme-hint-color">
        Подождите немного, мы восстанавливаем упражнения и подходы.
      </p>
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
        className="rounded-xl bg-tg-theme-secondary-bg-color px-4 py-2 text-sm font-medium text-tg-theme-text-color"
      >
        На главную
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
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      closeLabel="Закрыть подтверждение"
      bodyClassName="px-4 sm:px-0"
    >
      <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-tg-theme-secondary-bg-color px-4 py-3 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${
              confirmTone === 'danger'
                ? 'bg-red-500 text-white'
                : 'bg-tg-theme-button-color text-tg-theme-button-text-color'
            }`}
          >
            {confirmLabel}
          </button>
      </div>
    </Dialog>
  );
}

export default function WorkoutSession({ mode }: WorkoutSessionProps) {
  const { id } = useParams<{ id: string }>();

  if (mode === 'active') {
    return <ActiveWorkoutSession id={id} />;
  }

  if (!id) {
    return <WorkoutSessionError message="Неверный URL тренировки" />;
  }

  return <HistoryWorkoutSession id={id} />;
}
