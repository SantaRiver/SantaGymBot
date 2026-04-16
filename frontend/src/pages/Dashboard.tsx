import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useWorkoutStore } from '../store/workout';
import { Dumbbell } from 'lucide-react';

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
        <div className="text-center py-10 bg-tg-theme-secondary-bg-color/50 rounded-xl border border-dashed border-tg-theme-hint-color/30">
          <p className="text-tg-theme-hint-color text-sm">У вас пока нет ни одной тренировки.</p>
        </div>
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
