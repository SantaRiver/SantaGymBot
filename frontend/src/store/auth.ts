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
          // В Telegram WebApp initData будет возвращать строку, локально - пустую
          const initData = WebApp.initData || "test_mode=123456789";
          WebApp.ready(); // Сигнал Телеграму, что WebApp загрузился
          WebApp.expand(); // Разворачиваем на весь экран

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
    }
  )
);
