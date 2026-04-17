import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/client';
import WebApp from '@twa-dev/sdk';
import { getUserFacingErrorMessage, logDebugError } from '../utils/errors';

interface User {
  id: string;
  tg_id: number;
  username: string | null;
  language_code: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  authenticate: () => Promise<void>;
  logout: () => void;
}

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: typeof WebApp;
  };
};

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
            // Надежный способ получить WebApp из глобального window, обходя баги минификации @twa-dev/sdk
            const tWebApp = (window as TelegramWindow).Telegram?.WebApp || WebApp;
            const initData = tWebApp?.initData || "test_mode=123456789";

            // Вызываем методы только если они существуют (опциональная цепочка)
            tWebApp?.ready?.();
            tWebApp?.expand?.();

          const response = await apiClient.post('/auth/telegram-auth', {
            initData: initData,
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
