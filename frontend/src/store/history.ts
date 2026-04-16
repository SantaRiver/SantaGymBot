import { create } from 'zustand';
import { workoutsApi } from '../api/workouts';
import type { WorkoutReadWithDetails } from '../api/workouts';

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
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },
}));
