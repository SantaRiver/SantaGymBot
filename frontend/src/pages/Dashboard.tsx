import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useWorkoutStore } from '../store/workout';
import { useHistoryStore } from '../store/history';
import { useStatsStore } from '../store/stats';
import { Dumbbell, Calendar, Clock, ChevronRight, Settings } from 'lucide-react';
import type { WorkoutReadWithDetails } from '../api/workouts';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { useWorkoutStoreHydration } from '../hooks/useWorkoutStoreHydration';
import { formatDuration, formatWorkoutDate } from '../utils/formatting';

function summarizeWorkout(workout: WorkoutReadWithDetails) {
  const exerciseCount = workout.workout_exercises.length;
  const setCount = workout.workout_exercises.reduce((acc, we) => acc + we.sets.length, 0);
  return { exerciseCount, setCount };
}

function WorkoutHistoryCard({
  workout,
  timezone,
}: {
  workout: WorkoutReadWithDetails;
  timezone: string;
}) {
  const navigate = useNavigate();
  const { exerciseCount, setCount } = summarizeWorkout(workout);
  const date = workout.start_time ? formatWorkoutDate(workout.start_time, timezone) : 'Дата неизвестна';
  const duration =
    workout.start_time && workout.end_time
      ? formatDuration(workout.start_time, workout.end_time)
      : null;

  return (
    <button
      onClick={() => navigate(`/history/${workout.id}`)}
      className="w-full bg-tg-theme-secondary-bg-color rounded-2xl p-4 mb-3 flex items-center justify-between active:scale-[0.98] transition-transform"
    >
      <div className="text-left">
        <div className="flex items-center gap-1.5 mb-1">
          <Calendar className="w-3.5 h-3.5 text-tg-theme-hint-color" />
          <span className="text-sm font-semibold">{date}</span>
        </div>
        {duration && (
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-tg-theme-hint-color" />
            <span className="text-xs text-tg-theme-hint-color">{duration}</span>
          </div>
        )}
        <p className="text-xs text-tg-theme-hint-color">
          {exerciseCount} упр. · {setCount} подх.
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-tg-theme-hint-color flex-shrink-0" />
    </button>
  );
}

function HistorySection({ timezone }: { timezone: string }) {
  const { workouts, isLoading, error, fetchHistory } = useHistoryStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="text-center py-10 bg-tg-theme-secondary-bg-color/50 rounded-xl">
        <p className="text-tg-theme-hint-color text-sm">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-red-400/30">
        <p className="text-red-500 text-sm mb-2">Не удалось загрузить историю</p>
        <button
          onClick={fetchHistory}
          className="text-xs text-tg-theme-button-color underline"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="text-center py-10 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-tg-theme-hint-color/30">
        <p className="text-tg-theme-hint-color text-sm">У вас пока нет ни одной тренировки.</p>
      </div>
    );
  }

  return (
    <>
      {workouts.map((workout) => (
        <WorkoutHistoryCard key={workout.id} workout={workout} timezone={timezone} />
      ))}
    </>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const startWorkout = useWorkoutStore((state) => state.startWorkout);
  const { hasSession, status } = useWorkoutSession();
  const { isHydrated, supportsPersistence } = useWorkoutStoreHydration();
  const statsEntry = useStatsStore((state) => state.statsByPeriod.month);
  const fetchStats = useStatsStore((state) => state.fetchStats);
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const timezone = user?.timezone ?? 'UTC';

  useEffect(() => {
    if (!isHydrated || !hasSession || status === 'finished') {
      return;
    }

    navigate('/workout', { replace: true });
  }, [hasSession, isHydrated, navigate, status]);

  useEffect(() => {
    void fetchStats('month');
  }, [fetchStats]);

  const handleStart = async () => {
    setStarting(true);
    try {
      startWorkout();
      navigate('/workout');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="app-screen app-screen-with-tabbar">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Привет, {user?.username || 'Спортсмен'}! 👋</h1>
          <p className="text-tg-theme-hint-color text-sm">Готов к новой тренировке?</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-tg-theme-secondary-bg-color flex items-center justify-center text-tg-theme-button-color shadow-md active:scale-95 transition-transform"
            aria-label="Открыть настройки"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-tg-theme-secondary-bg-color flex items-center justify-center text-tg-theme-button-color font-bold shadow-md">
            {user?.username?.charAt(0).toUpperCase() || 'S'}
          </div>
        </div>
      </header>

      <section className="mb-6 rounded-2xl bg-gradient-to-br from-tg-theme-button-color/14 via-tg-theme-secondary-bg-color to-tg-theme-button-color/5 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-tg-theme-hint-color">Активность месяца</p>
            <h2 className="mt-1 text-2xl font-bold">
              {statsEntry.data?.summary.training_days ?? 0} дн. тренировок
            </h2>
            <p className="mt-2 text-sm text-tg-theme-hint-color">
              {statsEntry.data
                ? `${statsEntry.data.summary.completed_workouts} тренировок · ${statsEntry.data.summary.total_sets} подходов`
                : statsEntry.isLoading
                  ? 'Считаем статистику…'
                  : 'В этом месяце тренировок пока не было'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/stats')}
            className="rounded-xl bg-tg-theme-bg-color/80 px-3 py-2 text-sm font-semibold text-tg-theme-button-color active:scale-95 transition-transform"
          >
            Подробнее
          </button>
        </div>
      </section>

      <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm mb-6 border border-gray-100 dark:border-gray-800">
        <Dumbbell className="w-16 h-16 text-tg-theme-button-color mb-4" />
        <h2 className="text-xl font-bold mb-2">Начать тренировку</h2>
        <p className="text-sm text-tg-theme-hint-color mb-6">Отслеживай свои подходы и прогресс</p>

        <button
          onClick={handleStart}
          disabled={starting || (!isHydrated && supportsPersistence)}
          className="bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold py-4 px-8 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg shadow-tg-theme-button-color/30 active:scale-95 transition-transform disabled:opacity-60"
        >
          <Dumbbell className="w-5 h-5" />
          {starting ? 'Создаём...' : !isHydrated && supportsPersistence ? 'Загрузка...' : 'Старт'}
        </button>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-4">История тренировок</h3>
        <HistorySection timezone={timezone} />
      </div>

      <button
        onClick={logout}
        className="mt-12 w-full rounded-xl border border-dashed border-red-500/20 px-4 py-3 text-center text-sm text-red-500/80"
      >
        Сбросить сессию (dev)
      </button>
    </div>
  );
}
