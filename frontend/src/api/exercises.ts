import apiClient from './client';
import type { ExerciseCreate, ExerciseRead, ExerciseSimilarResponse } from './workouts';

export const exercisesApi = {
  getAll: async (): Promise<ExerciseRead[]> => {
    const res = await apiClient.get('/exercises/');
    return res.data;
  },

  getSimilar: async (name: string): Promise<ExerciseSimilarResponse> => {
    const res = await apiClient.get('/exercises/similar', {
      params: { name },
    });
    return res.data;
  },

  create: async (data: ExerciseCreate): Promise<ExerciseRead> => {
    const res = await apiClient.post('/exercises/', data);
    return res.data;
  },

  seed: async (): Promise<{ inserted: number; message: string }> => {
    const res = await apiClient.post('/exercises/seed');
    return res.data;
  },
};
