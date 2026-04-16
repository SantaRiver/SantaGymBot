import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useWorkoutStore } from '../store/workout';
import { useHistoryStore } from '../store/history';
import { Dumbbell, Calendar, Clock, ChevronRight } from 'lucide-react';
import type { WorkoutReadWithDetails } from '../api/workouts';

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

function formatDuration(startIso: string, endIso: string): string {
  const diffSeconds = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000,
  );
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function summarizeWorkout(workout: WorkoutReadWithDetails) {
  const exerciseCount = workout.workout_exercises.length;
  const setCount = workout.workout_exercises.reduce((acc, we) => acc + we.sets.length, 0);
  return { exerciseCount, setCount };
}

function WorkoutHistoryCard({ workout }: { workout: WorkoutReadWithDetails }) {
  const navigate = useNavigate();
  const { exerciseCount, setCount } = summarizeWorkout(workout);
  const date = workout.start_time ? formatDate(workout.start_time) : 'Дата неизвестна';
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

function HistorySection() {
  const { workouts, isLoading, error, fetchHistory } = useHistoryStore();

  useEffect(() => {
    fetchHistory();
  }, []);

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
        <WorkoutHistoryCard key={workout.id} workout={workout} />
      ))}
    </>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { startWorkout } = useWorkoutStore();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const workoutId = await startWorkout();
      navigate(`/workout/${workoutId}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold">Привет, {user?.username || 'Спортсмен'}! 👋</h1>
          <p className="text-tg-theme-hint-color text-sm">Готов к новой тренировке?</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-tg-theme-secondary-bg-color flex items-center justify-center text-tg-theme-button-color font-bold shadow-md">
          {user?.username?.charAt(0).toUpperCase() || 'S'}
        </div>
      </header>

      <div className="bg-tg-theme-secondary-bg-color rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm mb-6 border border-gray-100 dark:border-gray-800">
        <Dumbbell className="w-16 h-16 text-tg-theme-button-color mb-4" />
        <h2 className="text-xl font-bold mb-2">Начать тренировку</h2>
        <p className="text-sm text-tg-theme-hint-color mb-6">Отслеживай свои подходы и прогресс</p>

        <button
          onClick={handleStart}
          disabled={starting}
          className="bg-tg-theme-button-color text-tg-theme-button-text-color font-semibold py-4 px-8 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg shadow-tg-theme-button-color/30 active:scale-95 transition-transform disabled:opacity-60"
        >
          <Dumbbell className="w-5 h-5" />
          {starting ? 'Создаём...' : 'Старт'}
        </button>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-4">История тренировок</h3>
        <HistorySection />
      </div>

      <button
        onClick={logout}
        className="mt-12 w-full text-center text-red-500 text-sm opacity-50"
      >
        Сбросить сессию (dev)
      </button>
    </div>
  );
}
