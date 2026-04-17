import { useEffect, useState } from 'react';
import { useWorkoutStore } from '../store/workout';

export function useWorkoutSession() {
  const [
    workoutId,
    status,
    startedAt,
    exercises,
    restStartedAt,
    restDurationSeconds,
    isHydrated,
    isLoading,
    isSyncing,
    error,
  ] = useWorkoutStore((state) => [
    state.workoutId,
    state.status,
    state.startedAt,
    state.exercises,
    state.restStartedAt,
    state.restDurationSeconds,
    state.isHydrated,
    state.isLoading,
    state.isSyncing,
    state.error,
  ]);

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
  const restSeconds =
    restStartedAt === null || restDurationSeconds === null
      ? 0
      : Math.max(0, restDurationSeconds - Math.floor((now - restStartedAt) / 1000));

  return {
    workoutId,
    status,
    startedAt,
    exercises,
    isHydrated,
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
