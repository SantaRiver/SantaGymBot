import axios from 'axios';
import { useAuthStore } from '../store/auth';

const apiClient = axios.create({
  // Заглушка. Траефик марштрутизирует /api на наш бэкенд
  baseURL: import.meta.env.VITE_API_URL || 'https://api.santagym.local/api/v1',
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
