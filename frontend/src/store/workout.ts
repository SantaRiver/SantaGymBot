import { create } from 'zustand';
import { workoutsApi } from '../api/workouts';
import type { WorkoutReadWithDetails } from '../api/workouts';

interface WorkoutState {
  activeWorkout: WorkoutReadWithDetails | null;
  isLoading: boolean;
  error: string | null;

  elapsedSeconds: number;
  restSeconds: number;
  isRestActive: boolean;

  startWorkout: () => Promise<string>;
  loadWorkout: (id: string) => Promise<void>;
  finishWorkout: () => Promise<void>;

  addExercise: (exerciseId: string) => Promise<void>;
  addSet: (workoutExerciseId: string, reps: number | null, weight: number | null) => Promise<void>;

  tickElapsed: () => void;
  tickRest: () => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;

  reset: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeWorkout: null,
  isLoading: false,
  error: null,
  elapsedSeconds: 0,
  restSeconds: 0,
  isRestActive: false,

  startWorkout: async () => {
    set({ isLoading: true, error: null });
    try {
      const workout = await workoutsApi.create({
        status: 'in_progress',
        start_time: new Date().toISOString(),
      });
      const detailed = await workoutsApi.getById(workout.id);
      set({ activeWorkout: detailed, isLoading: false, elapsedSeconds: 0 });
      return workout.id;
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  loadWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workout = await workoutsApi.getById(id);
      set({ activeWorkout: workout, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  finishWorkout: async () => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    set({ isLoading: true });
    try {
      await workoutsApi.update(activeWorkout.id, {
        status: 'completed',
        end_time: new Date().toISOString(),
      });
      set({ activeWorkout: null, isLoading: false, elapsedSeconds: 0, isRestActive: false, restSeconds: 0 });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  addExercise: async (exerciseId: string) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const order = activeWorkout.workout_exercises.length + 1;
    const newExercise = await workoutsApi.addExercise(activeWorkout.id, { exercise_id: exerciseId, order });
    set({
      activeWorkout: {
        ...activeWorkout,
        workout_exercises: [...activeWorkout.workout_exercises, newExercise],
      },
    });
  },

  addSet: async (workoutExerciseId: string, reps: number | null, weight: number | null) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const newSet = await workoutsApi.addSet(workoutExerciseId, {
      workout_exercise_id: workoutExerciseId,
      reps: reps ?? undefined,
      weight: weight ?? undefined,
    });
    set({
      activeWorkout: {
        ...activeWorkout,
        workout_exercises: activeWorkout.workout_exercises.map((we) =>
          we.id === workoutExerciseId
            ? { ...we, sets: [...we.sets, newSet] }
            : we
        ),
      },
    });
  },

  tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
  tickRest: () =>
    set((s) => {
      if (s.restSeconds <= 1) return { restSeconds: 0, isRestActive: false };
      return { restSeconds: s.restSeconds - 1 };
    }),
  startRest: (seconds = 90) => set({ isRestActive: true, restSeconds: seconds }),
  stopRest: () => set({ isRestActive: false, restSeconds: 0 }),

  reset: () => set({ activeWorkout: null, elapsedSeconds: 0, restSeconds: 0, isRestActive: false, error: null }),
}));
