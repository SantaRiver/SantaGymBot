import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, Clock3, Dumbbell, RotateCcw } from 'lucide-react';
import type { StatsPeriod, WorkoutStatsTopExercise, WorkoutStatsWeek } from '../api/workouts';
import { useAuthStore } from '../store/auth';
import { useStatsStore } from '../store/stats';
import { formatWeekLabel } from '../utils/formatting';

const periodOptions: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'month', label: 'Этот месяц' },
  { value: 'all', label: 'Все время' },
];

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-tg-theme-secondary-bg-color p-4 shadow-sm">
      <p className="text-sm text-tg-theme-hint-color">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function ActivityChart({
  weeks,
  timezone,
}: {
  weeks: WorkoutStatsWeek[];
  timezone: string;
}) {
  const maxValue = Math.max(...weeks.map((week) => week.completed_workouts), 1);

  return (
    <section className="rounded-2xl bg-tg-theme-secondary-bg-color p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-tg-theme-button-color" aria-hidden="true" />
        <h2 className="text-base font-semibold">Активность по неделям</h2>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {weeks.map((week) => {
          const height = Math.max((week.completed_workouts / maxValue) * 100, 10);
          return (
            <div key={week.week_start} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end rounded-xl bg-tg-theme-bg-color/70 px-1 py-2">
                <div
                  className="w-full rounded-lg bg-tg-theme-button-color/85 transition-[height] duration-200"
                  style={{ height: `${height}%` }}
                  aria-label={`${week.completed_workouts} тренировок за неделю ${formatWeekLabel(week.week_start, timezone)}`}
                />
              </div>
              <span className="text-center text-[11px] leading-4 text-tg-theme-hint-color">
                {formatWeekLabel(week.week_start, timezone)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopExercises({
  items,
}: {
  items: WorkoutStatsTopExercise[];
}) {
  return (
    <section className="rounded-2xl bg-tg-theme-secondary-bg-color p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-tg-theme-button-color" aria-hidden="true" />
        <h2 className="text-base font-semibold">Топ упражнений</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-tg-theme-hint-color">Топ появится после завершенных тренировок.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.exercise_id}
              className="flex items-center justify-between gap-3 rounded-xl bg-tg-theme-bg-color/70 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{index + 1}. {item.name}</p>
                <p className="text-xs text-tg-theme-hint-color">
                  {item.workout_count} трен. · {item.set_count} подх.
                </p>
              </div>
              <div className="rounded-full bg-tg-theme-button-color/12 px-3 py-1 text-xs font-semibold text-tg-theme-button-color">
                {item.set_count}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function StatsPage() {
  const timezone = useAuthStore((state) => state.user?.timezone ?? 'UTC');
  const statsByPeriod = useStatsStore((state) => state.statsByPeriod);
  const fetchStats = useStatsStore((state) => state.fetchStats);
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const entry = statsByPeriod[period];

  useEffect(() => {
    void fetchStats(period);
  }, [fetchStats, period]);

  const handleRetry = () => {
    void fetchStats(period, { force: true });
  };

  return (
    <div className="app-screen app-screen-with-tabbar pb-8">
      <header className="mb-6 pt-4">
        <h1 className="text-2xl font-bold">Статистика</h1>
        <p className="mt-1 text-sm text-tg-theme-hint-color">
          Короткий обзор активности и нагрузки.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-tg-theme-secondary-bg-color p-1">
        {periodOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              period === option.value
                ? 'bg-tg-theme-button-color text-tg-theme-button-text-color'
                : 'text-tg-theme-text-color'
            }`}
            aria-pressed={period === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      {entry.isLoading && !entry.data ? (
        <div className="rounded-2xl bg-tg-theme-secondary-bg-color px-5 py-10 text-center">
          <p className="text-sm text-tg-theme-hint-color">Загрузка статистики…</p>
        </div>
      ) : null}

      {entry.error ? (
        <div className="rounded-2xl border border-dashed border-red-400/30 bg-tg-theme-secondary-bg-color px-5 py-10 text-center">
          <p className="mb-3 text-sm text-red-500">{entry.error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Повторить
          </button>
        </div>
      ) : null}

      {entry.data ? (
        <>
          <section className="mb-4 grid grid-cols-2 gap-3">
            <StatCard
              label="Дни тренировок"
              value={String(entry.data.summary.training_days)}
              accent="text-tg-theme-button-color"
            />
            <StatCard
              label="Тренировки"
              value={String(entry.data.summary.completed_workouts)}
              accent="text-emerald-600"
            />
            <StatCard
              label="Подходы"
              value={String(entry.data.summary.total_sets)}
              accent="text-amber-600"
            />
            <StatCard
              label="Время"
              value={`${entry.data.summary.total_duration_minutes} мин`}
              accent="text-fuchsia-600"
            />
          </section>

          {entry.data.summary.completed_workouts === 0 ? (
            <div className="rounded-2xl border border-dashed border-tg-theme-hint-color/30 bg-tg-theme-secondary-bg-color px-5 py-10 text-center">
              <CalendarDays className="mx-auto mb-3 h-8 w-8 text-tg-theme-hint-color" aria-hidden="true" />
              <p className="mb-2 text-base font-semibold">Пока нечего анализировать</p>
              <p className="text-sm text-tg-theme-hint-color">
                Статистика появится после первой завершенной тренировки.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <ActivityChart weeks={entry.data.activity_by_week} timezone={timezone} />
              <TopExercises items={entry.data.top_exercises} />
            </div>
          )}
        </>
      ) : null}

      {entry.data ? (
        <div className="mt-6 flex items-center gap-2 text-xs text-tg-theme-hint-color">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          Обновлено автоматически после загрузки экрана
        </div>
      ) : null}
    </div>
  );
}
