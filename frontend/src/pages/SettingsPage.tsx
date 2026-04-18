import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useWorkoutStore } from '../store/workout';

export default function SettingsPage() {
  const navigate = useNavigate();
  const stopRest = useWorkoutStore((state) => state.stopRest);
  const {
    restTimerEnabled,
    restDuration,
    setRestTimerEnabled,
    setRestDuration,
  } = useSettings();
  const timerDescriptionId = 'rest-timer-description';

  return (
    <div className="app-screen">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Настройки</h1>
          <p className="text-sm text-tg-theme-hint-color">Таймер отдыха</p>
        </div>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="flex items-center gap-1.5 bg-tg-theme-secondary-bg-color text-tg-theme-text-color px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
      </header>

      <div className="space-y-4">
        <section className="rounded-2xl bg-tg-theme-secondary-bg-color p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="rest-timer-heading" className="font-semibold">Таймер отдыха</h2>
              <p id={timerDescriptionId} className="mt-1 text-sm text-tg-theme-hint-color">
                Автоматически запускать таймер после сохранения подхода
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={restTimerEnabled}
              aria-labelledby="rest-timer-heading"
              aria-describedby={timerDescriptionId}
              onClick={() => {
                const nextValue = !restTimerEnabled;
                setRestTimerEnabled(nextValue);
                if (!nextValue) {
                  stopRest();
                }
              }}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                restTimerEnabled ? 'bg-tg-theme-button-color' : 'bg-tg-theme-hint-color/30'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  restTimerEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-tg-theme-secondary-bg-color p-5">
          <label className="block">
            <span className="block font-semibold mb-2">Длительность отдыха, сек</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={restDuration}
              disabled={!restTimerEnabled}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                setRestDuration(Number.isNaN(nextValue) ? 1 : nextValue);
              }}
              className="w-full rounded-xl bg-tg-theme-bg-color border border-tg-theme-hint-color/20 px-4 py-3 text-base focus:outline-none focus:border-tg-theme-button-color disabled:opacity-50"
            />
          </label>
        </section>
      </div>
    </div>
  );
}
