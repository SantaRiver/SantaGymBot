import { create } from 'zustand';

interface ToastItem {
  id: string;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  pushToast: (message: string) => void;
  removeToast: (id: string) => void;
}

const createToastId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],

  pushToast: (message) => {
    const id = createToastId();
    set((state) => ({
      items: [...state.items, { id, message }],
    }));

    window.setTimeout(() => {
      get().removeToast(id);
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));
