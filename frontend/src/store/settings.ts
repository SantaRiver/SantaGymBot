import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState {
  restTimerEnabled: boolean;
  restDuration: number;
  setRestTimerEnabled: (enabled: boolean) => void;
  setRestDuration: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      restTimerEnabled: true,
      restDuration: 90,

      setRestTimerEnabled: (enabled) => {
        set({ restTimerEnabled: enabled });
      },

      setRestDuration: (seconds) => {
        const normalized = Number.isFinite(seconds)
          ? Math.max(1, Math.round(seconds))
          : 90;

        set({ restDuration: normalized });
      },
    }),
    {
      name: 'workout-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        restTimerEnabled: state.restTimerEnabled,
        restDuration: state.restDuration,
      }),
    },
  ),
);
