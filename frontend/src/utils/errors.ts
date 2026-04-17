interface ApiErrorPayload {
  detail?: string;
}

interface ApiErrorShape {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: ApiErrorPayload;
  };
}

const DEFAULT_ERROR_MESSAGE = 'Не удалось выполнить запрос. Попробуйте ещё раз.';

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }

  const apiError = error as ApiErrorShape;
  const status = apiError.response?.status;
  const detail = apiError.response?.data?.detail;
  const message = apiError.message;

  if (status === 401) {
    return 'Сессия истекла. Попробуйте войти снова.';
  }

  if (status === 403) {
    return 'Недостаточно прав для этого действия.';
  }

  if (status === 404) {
    return 'Нужные данные не найдены.';
  }

  if (status !== undefined && status >= 500) {
    return 'Сервис временно недоступен. Попробуйте позже.';
  }

  if (detail) {
    return detail;
  }

  if (message === 'Network Error') {
    return 'Нет соединения с сервером. Проверьте интернет и повторите попытку.';
  }

  return message ?? fallback;
}

export function logDebugError(scope: string, error: unknown): void {
  // Keep diagnostic details in dev tools instead of rendering them into the UI.
  console.error(`[${scope}]`, error);
}
