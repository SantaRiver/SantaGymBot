import axios from 'axios';
import { useAuthStore } from '../store/auth';

function resolveApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api/v1';
  }

  const { hostname, protocol } = window.location;

  if (
    import.meta.env.DEV ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    return 'http://localhost:8000/api/v1';
  }

  if (hostname.startsWith('dev.')) {
    return `${protocol}//dev-api.${hostname.slice(4)}/api/v1`;
  }

  return `${protocol}//api.${hostname}/api/v1`;
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
