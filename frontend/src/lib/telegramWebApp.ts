import WebApp from '@twa-dev/sdk';

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: typeof WebApp;
  };
};

export const getTelegramWebApp = () => {
  if (typeof window === 'undefined') {
    return WebApp;
  }

  return (window as TelegramWindow).Telegram?.WebApp || WebApp;
};

export const initializeTelegramWebApp = () => {
  const telegramWebApp = getTelegramWebApp();

  telegramWebApp?.ready?.();
  telegramWebApp?.expand?.();
};
