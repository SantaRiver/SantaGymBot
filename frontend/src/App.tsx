import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useWorkoutStore } from './store/workout'
import { exercisesApi } from './api/exercises'
import Dashboard from './pages/Dashboard'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import WorkoutSession from './pages/WorkoutSession'
import { Dumbbell } from 'lucide-react'
import { ToastViewport } from './components/ToastViewport'
import { useWorkoutStoreHydration } from './hooks/useWorkoutStoreHydration'
import { initializeTelegramWebApp } from './lib/telegramWebApp'
import { RootTabBar } from './components/RootTabBar'

const FullScreenLoader = () => (
  <div className="app-shell">
    <div className="app-screen app-screen-centered bg-tg-theme-bg-color">
      <Dumbbell className="mb-4 w-12 h-12 text-tg-theme-button-color animate-pulse" />
      <div className="font-medium text-tg-theme-text-color">Загрузка дневника...</div>
    </div>
  </div>
);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, token } = useAuthStore();
  return (user && token) ? children : <Navigate to="/" replace />;
}

function AppLayout() {
  const location = useLocation();
  const isRootTabRoute = location.pathname === '/' || location.pathname === '/stats';

  return (
    <div className="app-shell">
      <ToastViewport />
      <Routes>
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/workout" element={<RequireAuth><WorkoutSession mode="active" /></RequireAuth>} />
        <Route path="/workout/:id" element={<RequireAuth><WorkoutSession mode="active" /></RequireAuth>} />
        <Route path="/history/:id" element={<RequireAuth><WorkoutSession mode="history" /></RequireAuth>} />
      </Routes>
      {isRootTabRoute ? <RootTabBar /> : null}
    </div>
  );
}

function App() {
  const { token, isLoading, authenticate, error } = useAuthStore();
  const processSyncQueue = useWorkoutStore((state) => state.processSyncQueue);
  const { isHydrated } = useWorkoutStoreHydration();

  useEffect(() => {
    initializeTelegramWebApp();
  }, []);

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
      <div className="app-shell">
        <div className="app-screen app-screen-centered">
          <h2 className="mb-2 text-xl font-bold text-red-500">Ошибка авторизации</h2>
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
      </div>
    );
  }

  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App
