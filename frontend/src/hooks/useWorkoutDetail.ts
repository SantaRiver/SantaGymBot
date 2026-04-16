import { useEffect, useState } from 'react';
import { workoutsApi } from '../api/workouts';
import type { WorkoutReadWithDetails } from '../api/workouts';

interface WorkoutDetailState {
  workout: WorkoutReadWithDetails | null;
  isLoading: boolean;
  error: string | null;
}

export function useWorkoutDetail(id: string): WorkoutDetailState {
  const [state, setState] = useState<WorkoutDetailState>({
    workout: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState({ workout: null, isLoading: true, error: null });

    workoutsApi
      .getById(id)
      .then((workout) => {
        if (!cancelled) setState({ workout, isLoading: false, error: null });
      })
      .catch((e: any) => {
        if (!cancelled) setState({ workout: null, isLoading: false, error: e.message });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
