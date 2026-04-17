import apiClient from './client';

export interface WorkoutRead {
  id: string;
  user_id: string;
  name: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSetRead {
  id: string;
  workout_exercise_id: string;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  rest_time_after_seconds: number | null;
  created_at: string;
}

export interface ExerciseRead {
  id: string;
  name: string;
  target_muscle_group: string | null;
  user_id: string | null;
  visibility: 'system' | 'private' | 'public';
  created_at: string;
}

export interface ExerciseCreate {
  name: string;
  target_muscle_group?: string;
}

export interface ExerciseSimilar {
  id: string;
  name: string;
  target_muscle_group: string | null;
  visibility: 'system' | 'private' | 'public';
  similarity: number;
}

export interface ExerciseSimilarResponse {
  matches: ExerciseSimilar[];
}

export interface WorkoutExerciseRead {
  id: string;
  workout_id: string;
  exercise_id: string;
  order: number;
  exercise: ExerciseRead | null;
  sets: WorkoutSetRead[];
}

export interface WorkoutReadWithDetails extends WorkoutRead {
  workout_exercises: WorkoutExerciseRead[];
}

export const workoutsApi = {
  create: async (data: { name?: string; status?: string; start_time?: string }): Promise<WorkoutRead> => {
    const res = await apiClient.post('/workouts/', data);
    return res.data;
  },

  getAll: async (): Promise<WorkoutReadWithDetails[]> => {
    const res = await apiClient.get('/workouts/');
    return res.data;
  },

  getById: async (id: string): Promise<WorkoutReadWithDetails> => {
    const res = await apiClient.get(`/workouts/${id}`);
    return res.data;
  },

  update: async (id: string, data: { status?: string; end_time?: string; name?: string; notes?: string }): Promise<WorkoutRead> => {
    const res = await apiClient.patch(`/workouts/${id}`, data);
    return res.data;
  },

  discard: async (id: string): Promise<void> => {
    await apiClient.delete(`/workouts/${id}`);
  },

  addExercise: async (workoutId: string, data: { exercise_id: string; order: number }): Promise<WorkoutExerciseRead> => {
    const res = await apiClient.post(`/workouts/${workoutId}/exercises`, data);
    return res.data;
  },

  removeExercise: async (workoutId: string, workoutExerciseId: string): Promise<void> => {
    await apiClient.delete(`/workouts/${workoutId}/exercises/${workoutExerciseId}`);
  },

  reorderExercises: async (workoutId: string, workoutExerciseIds: string[]): Promise<void> => {
    await apiClient.patch(`/workouts/${workoutId}/exercises/reorder`, {
      workout_exercise_ids: workoutExerciseIds,
    });
  },

  addSet: async (workoutExerciseId: string, data: { reps?: number; weight?: number; duration_seconds?: number; rest_time_after_seconds?: number; workout_exercise_id: string }): Promise<WorkoutSetRead> => {
    const res = await apiClient.post(`/workouts/exercises/${workoutExerciseId}/sets`, data);
    return res.data;
  },
};
