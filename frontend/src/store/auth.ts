import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/client';
import { getUserFacingErrorMessage, logDebugError } from '../utils/errors';
import { getTelegramWebApp } from '../lib/telegramWebApp';

interface User {
  id: string;
  tg_id: number;
  username: string | null;
  language_code: string;
  timezone: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  authenticate: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      error: null,
      authenticate: async () => {
        set({ isLoading: true, error: null });
        try {
          const tWebApp = getTelegramWebApp();
          const initData = tWebApp?.initData || "test_mode=123456789";

          const response = await apiClient.post('/auth/telegram-auth', {
            initData,
          });

          set({
            token: response.data.access_token,
            user: response.data.user,
            isLoading: false
          });
        } catch (error: unknown) {
          logDebugError('auth.authenticate', error);
          set({
            error: getUserFacingErrorMessage(
              error,
              'Не удалось войти в приложение. Проверьте соединение и попробуйте снова.',
            ),
            isLoading: false
          });
        }
      },
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-storage',
      // Мы сохраняем JWT и User в localStorage (для Offline-first в будущем)
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // После восстановления из localStorage isLoading должен быть false
        if (state) state.isLoading = false;
      },
    }
  )
);
