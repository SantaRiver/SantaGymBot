import { useEffect, useState } from 'react';
import { workoutsApi } from '../api/workouts';
import type { WorkoutReadWithDetails } from '../api/workouts';
import { getUserFacingErrorMessage, logDebugError } from '../utils/errors';

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
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setState({ workout: null, isLoading: true, error: null });
      }
    }, 0);

    workoutsApi
      .getById(id)
      .then((workout) => {
        if (!cancelled) setState({ workout, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        logDebugError('workoutDetail.getById', error);
        if (!cancelled) {
          setState({
            workout: null,
            isLoading: false,
            error: getUserFacingErrorMessage(
              error,
              'Не удалось открыть тренировку. Попробуйте ещё раз.',
            ),
          });
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [id]);

  return state;
}
