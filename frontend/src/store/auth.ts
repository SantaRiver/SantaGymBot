import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/client';
import WebApp from '@twa-dev/sdk';

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
            const tWebApp = (window as any).Telegram?.WebApp || WebApp;
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
        } catch (error: any) {
          set({
            error: `Auth error: ${error.message} | URL: ${error.config?.baseURL}${error.config?.url} | Resp:${JSON.stringify(error.response?.data)}`,
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
