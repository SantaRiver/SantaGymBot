import { useEffect, useState } from 'react';
import { useWorkoutStore } from '../store/workout';
import { useSettings } from './useSettings';

export function useWorkoutSession() {
  const workoutId = useWorkoutStore((state) => state.workoutId);
  const status = useWorkoutStore((state) => state.status);
  const startedAt = useWorkoutStore((state) => state.startedAt);
  const exercises = useWorkoutStore((state) => state.exercises);
  const restStartedAt = useWorkoutStore((state) => state.restStartedAt);
  const restDurationSeconds = useWorkoutStore((state) => state.restDurationSeconds);
  const isLoading = useWorkoutStore((state) => state.isLoading);
  const isSyncing = useWorkoutStore((state) => state.isSyncing);
  const error = useWorkoutStore((state) => state.error);
  const { restTimerEnabled, restDuration } = useSettings();

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const elapsedSeconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  const effectiveRestDuration = restTimerEnabled
    ? restDurationSeconds ?? restDuration
    : null;

  const restSeconds =
    restStartedAt === null || effectiveRestDuration === null
      ? 0
      : Math.max(0, effectiveRestDuration - Math.floor((now - restStartedAt) / 1000));

  return {
    workoutId,
    status,
    startedAt,
    exercises,
    isLoading,
    isSyncing,
    error,
    elapsedSeconds,
    restSeconds,
    isRestActive: restSeconds > 0,
    hasSession: startedAt !== null,
    hasExercises: exercises.length > 0,
  };
}
