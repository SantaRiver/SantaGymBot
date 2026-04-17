import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useWorkoutStore } from './store/workout'
import { exercisesApi } from './api/exercises'
import Dashboard from './pages/Dashboard'
import SettingsPage from './pages/SettingsPage'
import WorkoutSession from './pages/WorkoutSession'
import { Dumbbell } from 'lucide-react'
import { ToastViewport } from './components/ToastViewport'
import { useWorkoutStoreHydration } from './hooks/useWorkoutStoreHydration'

const FullScreenLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-tg-theme-bg-color">
    <Dumbbell className="w-12 h-12 text-tg-theme-button-color animate-pulse mb-4" />
    <div className="text-tg-theme-text-color font-medium">Загрузка дневника...</div>
  </div>
);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, token } = useAuthStore();
  return (user && token) ? children : <Navigate to="/" replace />;
}

function App() {
  const { token, isLoading, authenticate, error } = useAuthStore();
  const processSyncQueue = useWorkoutStore((state) => state.processSyncQueue);
  const { isHydrated } = useWorkoutStoreHydration();

  useEffect(() => {
    if (!token) {
      authenticate();
    } else {
      exercisesApi.seed().catch(() => {});
    }
  }, [token, authenticate]);

  useEffect(() => {
    if (!token || !isHydrated) {
      return;
    }

    void processSyncQueue();
  }, [token, isHydrated, processSyncQueue]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (error && !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2">Ошибка авторизации</h2>
        <p className="max-w-sm text-tg-theme-hint-color">
          {error}
        </p>
        <button
          onClick={() => authenticate()}
          className="mt-6 rounded-lg bg-tg-theme-button-color px-4 py-2 text-tg-theme-button-text-color"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <Router>
      <ToastViewport />
      <Routes>
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/workout" element={<RequireAuth><WorkoutSession mode="active" /></RequireAuth>} />
        <Route path="/workout/:id" element={<RequireAuth><WorkoutSession mode="active" /></RequireAuth>} />
        <Route path="/history/:id" element={<RequireAuth><WorkoutSession mode="history" /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App
