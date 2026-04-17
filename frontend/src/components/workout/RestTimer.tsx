function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface RestTimerProps {
  seconds: number;
  onSkip: () => void;
}

export function RestTimer({ seconds, onSkip }: RestTimerProps) {
  return (
    <div
      className="fixed left-4 right-4 z-20 flex items-center justify-between rounded-2xl bg-tg-theme-secondary-bg-color p-4 shadow-lg"
      style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div>
        <p className="text-xs text-tg-theme-hint-color mb-1">Отдых</p>
        <p className="text-3xl font-bold tabular-nums text-tg-theme-button-color">{formatTime(seconds)}</p>
      </div>
      <button
        onClick={onSkip}
        className="bg-tg-theme-button-color text-tg-theme-button-text-color px-5 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
      >
        Пропустить
      </button>
    </div>
  );
}
