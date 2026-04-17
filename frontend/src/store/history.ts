import { create } from 'zustand';
import { workoutsApi } from '../api/workouts';
import type { WorkoutReadWithDetails } from '../api/workouts';
import { getUserFacingErrorMessage, logDebugError } from '../utils/errors';

interface HistoryState {
  workouts: WorkoutReadWithDetails[];
  isLoading: boolean;
  error: string | null;

  fetchHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  workouts: [],
  isLoading: false,
  error: null,

  fetchHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const all = await workoutsApi.getAll();
      const completed = all.filter((w) => w.status === 'completed');
      set({ workouts: completed, isLoading: false });
    } catch (error: unknown) {
      logDebugError('history.fetchHistory', error);
      set({
        error: getUserFacingErrorMessage(
          error,
          'Не удалось загрузить историю тренировок. Попробуйте ещё раз.',
        ),
        isLoading: false,
      });
    }
  },
}));
