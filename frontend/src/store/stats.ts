import { create } from 'zustand';
import { workoutsApi } from '../api/workouts';
import type { StatsPeriod, WorkoutStats } from '../api/workouts';
import { getUserFacingErrorMessage, logDebugError } from '../utils/errors';

interface StatsEntry {
  data: WorkoutStats | null;
  isLoading: boolean;
  error: string | null;
}

interface StatsState {
  statsByPeriod: Record<StatsPeriod, StatsEntry>;
  fetchStats: (period: StatsPeriod, options?: { force?: boolean }) => Promise<void>;
  invalidateStats: (period?: StatsPeriod) => void;
}

const emptyEntry = (): StatsEntry => ({
  data: null,
  isLoading: false,
  error: null,
});

export const useStatsStore = create<StatsState>((set, get) => ({
  statsByPeriod: {
    month: emptyEntry(),
    all: emptyEntry(),
  },

  fetchStats: async (period, options) => {
    const current = get().statsByPeriod[period];
    if (!options?.force && (current.isLoading || current.data)) {
      return;
    }

    set((state) => ({
      statsByPeriod: {
        ...state.statsByPeriod,
        [period]: {
          ...state.statsByPeriod[period],
          isLoading: true,
          error: null,
        },
      },
    }));

    try {
      const data = await workoutsApi.getStats(period);
      set((state) => ({
        statsByPeriod: {
          ...state.statsByPeriod,
          [period]: {
            data,
            isLoading: false,
            error: null,
          },
        },
      }));
    } catch (error: unknown) {
      logDebugError(`stats.fetch.${period}`, error);
      set((state) => ({
        statsByPeriod: {
          ...state.statsByPeriod,
          [period]: {
            data: null,
            isLoading: false,
            error: getUserFacingErrorMessage(
              error,
              'Не удалось загрузить статистику. Попробуйте ещё раз.',
            ),
          },
        },
      }));
    }
  },

  invalidateStats: (period) => {
    if (!period) {
      set({
        statsByPeriod: {
          month: emptyEntry(),
          all: emptyEntry(),
        },
      });
      return;
    }

    set((state) => ({
      statsByPeriod: {
        ...state.statsByPeriod,
        [period]: emptyEntry(),
      },
    }));
  },
}));
