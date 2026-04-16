import apiClient from './client';
import type { ExerciseRead } from './workouts';

export const exercisesApi = {
  getAll: async (): Promise<ExerciseRead[]> => {
    const res = await apiClient.get('/exercises/');
    return res.data;
  },

  seed: async (): Promise<{ inserted: number; message: string }> => {
    const res = await apiClient.post('/exercises/seed');
    return res.data;
  },
};
