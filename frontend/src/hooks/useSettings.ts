import { useSettingsStore } from '../store/settings';

export function useSettings() {
  const restTimerEnabled = useSettingsStore((state) => state.restTimerEnabled);
  const restDuration = useSettingsStore((state) => state.restDuration);
  const setRestTimerEnabled = useSettingsStore((state) => state.setRestTimerEnabled);
  const setRestDuration = useSettingsStore((state) => state.setRestDuration);

  return {
    restTimerEnabled,
    restDuration,
    setRestTimerEnabled,
    setRestDuration,
  };
}
