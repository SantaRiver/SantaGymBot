import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ExerciseRead } from '../api/workouts';
import { workoutsApi } from '../api/workouts';
import { useToastStore } from './toast';
import { useSettingsStore } from './settings';
import { getUserFacingErrorMessage, logDebugError } from '../utils/errors';
import {
  createEmptyWorkoutSessionSnapshot,
  createLocalExercise,
  createLocalId,
  createLocalSet,
  mapWorkoutToSessionSnapshot,
  type SyncQueueAction,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
  type WorkoutSessionSnapshot,
  type WorkoutSessionStatus,
} from './workout-session.types';

const RETRY_DELAY_MS = 5000;
let queueRetryTimer: number | null = null;

type PersistedWorkoutState = WorkoutSessionSnapshot;

interface WorkoutState extends WorkoutSessionSnapshot {
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  startWorkout: () => void;
  restoreWorkout: (id: string) => Promise<void>;
  finishWorkout: () => Promise<void>;
  addExercise: (exercise: ExerciseRead) => void;
  removeExercise: (exerciseLocalId: string) => void;
  moveExercise: (exerciseLocalId: string, direction: 'up' | 'down') => void;
  addSet: (exerciseLocalId: string) => void;
  updateSetDraft: (
    exerciseLocalId: string,
    setLocalId: string,
    patch: Partial<Pick<WorkoutSessionSet, 'reps' | 'weight'>>,
  ) => void;
  commitSet: (exerciseLocalId: string, setLocalId: string) => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;
  discardWorkout: () => Promise<void>;
  processSyncQueue: () => Promise<void>;
  reset: () => void;
}

const emptySnapshot = createEmptyWorkoutSessionSnapshot();

const normalizeExerciseOrder = (
  exercises: WorkoutSessionExercise[],
): WorkoutSessionExercise[] =>
  exercises.map((exercise, index) => ({
    ...exercise,
    order: index + 1,
  }));

const replaceExercise = (
  exercises: WorkoutSessionExercise[],
  exerciseLocalId: string,
  updater: (exercise: WorkoutSessionExercise) => WorkoutSessionExercise,
): WorkoutSessionExercise[] =>
  exercises.map((exercise) =>
    exercise.localId === exerciseLocalId ? updater(exercise) : exercise,
  );

const replaceSet = (
  exercises: WorkoutSessionExercise[],
  exerciseLocalId: string,
  setLocalId: string,
  updater: (set: WorkoutSessionSet) => WorkoutSessionSet,
): WorkoutSessionExercise[] =>
  replaceExercise(exercises, exerciseLocalId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => (set.localId === setLocalId ? updater(set) : set)),
  }));

const findExercise = (
  exercises: WorkoutSessionExercise[],
  exerciseLocalId: string,
): WorkoutSessionExercise | undefined =>
  exercises.find((exercise) => exercise.localId === exerciseLocalId);

const findSet = (
  exercises: WorkoutSessionExercise[],
  exerciseLocalId: string,
  setLocalId: string,
): { exercise: WorkoutSessionExercise; set: WorkoutSessionSet } | undefined => {
  const exercise = findExercise(exercises, exerciseLocalId);
  const set = exercise?.sets.find((item) => item.localId === setLocalId);

  if (!exercise || !set) {
    return undefined;
  }

  return { exercise, set };
};

const getPersistedSnapshot = (state: WorkoutState): PersistedWorkoutState => {
  const shouldPersistSession =
    state.startedAt !== null && state.exercises.length > 0 && state.status !== 'finished';

  return {
    workoutId: shouldPersistSession ? state.workoutId : null,
    status: shouldPersistSession ? state.status : 'draft',
    startedAt: shouldPersistSession ? state.startedAt : null,
    restStartedAt: shouldPersistSession ? state.restStartedAt : null,
    restDurationSeconds: shouldPersistSession ? state.restDurationSeconds : null,
    exercises: shouldPersistSession ? state.exercises : [],
    unsyncedChanges: state.unsyncedChanges,
  };
};

const clearQueueTimer = () => {
  if (queueRetryTimer !== null) {
    window.clearTimeout(queueRetryTimer);
    queueRetryTimer = null;
  }
};

const enqueueUniqueAction = (
  queue: SyncQueueAction[],
  action: SyncQueueAction,
): SyncQueueAction[] => {
  if (action.type === 'save_set') {
    return [
      ...queue.filter(
        (item) =>
          item.type !== 'save_set' ||
          item.exerciseLocalId !== action.exerciseLocalId ||
          item.setLocalId !== action.setLocalId,
      ),
      action,
    ];
  }

  if (action.type === 'reorder_exercises') {
    return [...queue.filter((item) => item.type !== 'reorder_exercises'), action];
  }

  if (action.type === 'finish_workout') {
    return [...queue.filter((item) => item.type !== 'finish_workout'), action];
  }

  return [...queue, action];
};

const appendReorderIfNeeded = (state: WorkoutState): SyncQueueAction[] => {
  if (!state.workoutId || state.exercises.length < 2) {
    return state.unsyncedChanges.filter((item) => item.type !== 'reorder_exercises');
  }

  const canReorder = state.exercises.every((exercise) => exercise.workoutExerciseId);
  if (!canReorder) {
    return state.unsyncedChanges.filter((item) => item.type !== 'reorder_exercises');
  }

  return enqueueUniqueAction(state.unsyncedChanges, {
    id: createLocalId('sync'),
    type: 'reorder_exercises',
    workoutId: state.workoutId,
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
};

const markExerciseFailure = (
  exercises: WorkoutSessionExercise[],
  exerciseLocalId: string,
  error: string,
): WorkoutSessionExercise[] =>
  replaceExercise(exercises, exerciseLocalId, (exercise) => ({
    ...exercise,
    syncStatus: 'failed',
    lastError: error,
  }));

const markSetFailure = (
  exercises: WorkoutSessionExercise[],
  exerciseLocalId: string,
  setLocalId: string,
  error: string,
): WorkoutSessionExercise[] =>
  replaceSet(exercises, exerciseLocalId, setLocalId, (set) => ({
    ...set,
    syncStatus: 'failed',
    lastError: error,
  }));

const getApiErrorMessage = (error: unknown): string => {
  return getUserFacingErrorMessage(
    error,
    'Не удалось синхронизировать тренировку. Изменения сохранятся при следующей попытке.',
  );
};

const parseOptionalInteger = (value: string): number | null => {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseOptionalFloat = (value: string): number | null => {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const ensureRemoteWorkout = async (): Promise<string> => {
  const state = useWorkoutStore.getState();
  if (state.workoutId) {
    return state.workoutId;
  }

  const startTime = new Date(state.startedAt ?? Date.now()).toISOString();
  const workout = await workoutsApi.create({
    status: 'in_progress',
    start_time: startTime,
  });

  useWorkoutStore.setState({ workoutId: workout.id });
  return workout.id;
};

const scheduleRetry = (nextAttemptAt: number) => {
  clearQueueTimer();
  const delay = Math.max(nextAttemptAt - Date.now(), 0);
  queueRetryTimer = window.setTimeout(() => {
    queueRetryTimer = null;
    void useWorkoutStore.getState().processSyncQueue();
  }, delay);
};

const runQueueAction = async (action: SyncQueueAction): Promise<void> => {
  const state = useWorkoutStore.getState();

  if (action.type === 'add_exercise') {
    const exercise = findExercise(state.exercises, action.exerciseLocalId);
    if (!exercise) {
      return;
    }

    if (exercise.workoutExerciseId) {
      useWorkoutStore.setState((current) => ({
        unsyncedChanges: appendReorderIfNeeded(current),
      }));
      return;
    }

    const workoutId = await ensureRemoteWorkout();
    const savedExercise = await workoutsApi.addExercise(workoutId, {
      exercise_id: exercise.exerciseId,
      order: exercise.order,
    });

    useWorkoutStore.setState((current) => ({
      exercises: replaceExercise(current.exercises, action.exerciseLocalId, (item) => ({
        ...item,
        workoutExerciseId: savedExercise.id,
        syncStatus: 'synced',
        lastError: null,
      })),
    }));
    useWorkoutStore.setState((current) => ({
      unsyncedChanges: appendReorderIfNeeded(current),
    }));
    return;
  }

  if (action.type === 'save_set') {
    const target = findSet(state.exercises, action.exerciseLocalId, action.setLocalId);
    if (!target) {
      return;
    }

    const { exercise, set } = target;
    if (!exercise.workoutExerciseId) {
      throw new Error('Упражнение ещё не синхронизировано');
    }

    const payload = {
      reps: parseOptionalInteger(set.reps),
      weight: parseOptionalFloat(set.weight),
    };

    const savedSet = set.setId
      ? await workoutsApi.updateSet(set.setId, payload)
      : await workoutsApi.addSet(exercise.workoutExerciseId, {
          workout_exercise_id: exercise.workoutExerciseId,
          reps: payload.reps ?? undefined,
          weight: payload.weight ?? undefined,
        });

    useWorkoutStore.setState((current) => ({
      exercises: replaceSet(current.exercises, action.exerciseLocalId, action.setLocalId, (item) => ({
        ...item,
        setId: savedSet.id,
        syncStatus: 'synced',
        lastError: null,
        lastSyncedReps: item.reps,
        lastSyncedWeight: item.weight,
      })),
    }));
    return;
  }

  if (action.type === 'remove_exercise') {
    await workoutsApi.removeExercise(action.workoutId, action.workoutExerciseId);
    return;
  }

  if (action.type === 'discard_workout') {
    await workoutsApi.discard(action.workoutId);
    return;
  }

  if (action.type === 'finish_workout') {
    const workoutId = action.workoutId ?? useWorkoutStore.getState().workoutId ?? (await ensureRemoteWorkout());
    await workoutsApi.update(workoutId, {
      status: 'completed',
      end_time: action.finishedAt,
    });
    useWorkoutStore.setState((current) => ({
      ...(current.workoutId === workoutId ? emptySnapshot : {}),
      error: null,
    }));
    return;
  }

  if (action.type === 'reorder_exercises') {
    const currentState = useWorkoutStore.getState();
    if (currentState.workoutId !== action.workoutId) {
      return;
    }

    const remoteIds = currentState.exercises
      .map((exercise) => exercise.workoutExerciseId)
      .filter((exerciseId): exerciseId is string => Boolean(exerciseId));

    if (remoteIds.length < 2 || remoteIds.length !== currentState.exercises.length) {
      return;
    }

    await workoutsApi.reorderExercises(action.workoutId, remoteIds);
  }
};

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      ...emptySnapshot,
      isLoading: false,
      isSyncing: false,
      error: null,

      startWorkout: () => {
        const { startedAt, status } = get();
        if (startedAt && status !== 'finished') {
          return;
        }

        set({
          ...emptySnapshot,
          startedAt: Date.now(),
          status: 'draft',
          error: null,
        });
      },

      restoreWorkout: async (id) => {
        const current = get();
        if (current.isLoading || (current.workoutId === id && current.startedAt !== null)) {
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const workout = await workoutsApi.getById(id);
          const snapshot = mapWorkoutToSessionSnapshot(workout);
          set({
            ...snapshot,
            unsyncedChanges: current.unsyncedChanges,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: getApiErrorMessage(error),
          });
        }
      },

      finishWorkout: async () => {
        const current = get();
        if (current.startedAt === null) {
          return;
        }

        if (current.exercises.length === 0) {
          if (current.workoutId) {
            set({
              ...emptySnapshot,
              unsyncedChanges: enqueueUniqueAction(current.unsyncedChanges, {
                id: createLocalId('sync'),
                type: 'discard_workout',
                workoutId: current.workoutId,
                attempts: 0,
                nextAttemptAt: Date.now(),
              }),
              error: null,
            });
            void get().processSyncQueue();
            return;
          }

          set({ ...emptySnapshot, error: null });
          return;
        }

        const finishedAt = new Date().toISOString();
        set((state) => ({
          status: 'finished' as WorkoutSessionStatus,
          restStartedAt: null,
          restDurationSeconds: null,
          unsyncedChanges: enqueueUniqueAction(state.unsyncedChanges, {
            id: createLocalId('sync'),
            type: 'finish_workout',
            workoutId: state.workoutId,
            finishedAt,
            attempts: 0,
            nextAttemptAt: Date.now(),
          }),
        }));

        void get().processSyncQueue();
      },

      addExercise: (exercise) => {
        if (get().startedAt === null) {
          get().startWorkout();
        }

        const localExercise = createLocalExercise(exercise, get().exercises.length + 1);
        set((state) => ({
          exercises: [...state.exercises, localExercise],
          status: 'active',
          error: null,
          unsyncedChanges: enqueueUniqueAction(state.unsyncedChanges, {
            id: createLocalId('sync'),
            type: 'add_exercise',
            exerciseLocalId: localExercise.localId,
            attempts: 0,
            nextAttemptAt: Date.now(),
          }),
        }));

        void get().processSyncQueue();
      },

      removeExercise: (exerciseLocalId) => {
        const current = get();
        const target = findExercise(current.exercises, exerciseLocalId);
        if (!target) {
          return;
        }

        const exercises = normalizeExerciseOrder(
          current.exercises.filter((exercise) => exercise.localId !== exerciseLocalId),
        );
        const queueWithoutExercise = current.unsyncedChanges.filter((item) => {
          if (item.type === 'add_exercise' && item.exerciseLocalId === exerciseLocalId) {
            return false;
          }

          if (item.type === 'save_set' && item.exerciseLocalId === exerciseLocalId) {
            return false;
          }

          return true;
        });

        let nextQueue = queueWithoutExercise;
        if (target.workoutExerciseId && current.workoutId) {
          nextQueue = enqueueUniqueAction(nextQueue, {
            id: createLocalId('sync'),
            type: 'remove_exercise',
            workoutId: current.workoutId,
            workoutExerciseId: target.workoutExerciseId,
            attempts: 0,
            nextAttemptAt: Date.now(),
          });
        }

        if (exercises.length === 0) {
          if (current.workoutId) {
            nextQueue = enqueueUniqueAction(nextQueue, {
              id: createLocalId('sync'),
              type: 'discard_workout',
              workoutId: current.workoutId,
              attempts: 0,
              nextAttemptAt: Date.now(),
            });
          }

          set({
            ...emptySnapshot,
            unsyncedChanges: nextQueue.filter((item) => item.type !== 'reorder_exercises'),
            error: null,
          });
          void get().processSyncQueue();
          return;
        }

        set({
          exercises,
          unsyncedChanges: appendReorderIfNeeded({
            ...current,
            exercises,
            unsyncedChanges: nextQueue,
          } as WorkoutState),
          error: null,
        });

        void get().processSyncQueue();
      },

      moveExercise: (exerciseLocalId, direction) => {
        const exercises = [...get().exercises];
        const currentIndex = exercises.findIndex((exercise) => exercise.localId === exerciseLocalId);
        if (currentIndex === -1) {
          return;
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= exercises.length) {
          return;
        }

        const [exercise] = exercises.splice(currentIndex, 1);
        exercises.splice(targetIndex, 0, exercise);
        const normalized = normalizeExerciseOrder(exercises);

        set((state) => ({
          exercises: normalized,
          unsyncedChanges: appendReorderIfNeeded({
            ...state,
            exercises: normalized,
          }),
        }));

        void get().processSyncQueue();
      },

      addSet: (exerciseLocalId) => {
        set((state) => ({
          exercises: replaceExercise(state.exercises, exerciseLocalId, (exercise) => ({
            ...exercise,
            sets: [...exercise.sets, createLocalSet()],
          })),
        }));
      },

      updateSetDraft: (exerciseLocalId, setLocalId, patch) => {
        set((state) => ({
          exercises: replaceSet(state.exercises, exerciseLocalId, setLocalId, (set) => {
            const nextReps = patch.reps ?? set.reps;
            const nextWeight = patch.weight ?? set.weight;

            return {
              ...set,
              reps: nextReps,
              weight: nextWeight,
              syncStatus:
                set.setId !== null &&
                nextReps === set.lastSyncedReps &&
                nextWeight === set.lastSyncedWeight
                  ? 'synced'
                  : set.syncStatus,
              lastError: null,
            };
          }),
        }));
      },

      commitSet: (exerciseLocalId, setLocalId) => {
        const target = findSet(get().exercises, exerciseLocalId, setLocalId);
        if (!target) {
          return;
        }

        const { set: targetSet } = target;
        const isBlank = targetSet.reps.trim() === '' && targetSet.weight.trim() === '';
        if (isBlank && !targetSet.setId) {
          set((state) => ({
            exercises: replaceExercise(state.exercises, exerciseLocalId, (exercise) => ({
              ...exercise,
              sets: exercise.sets.filter((item) => item.localId !== setLocalId),
            })),
          }));
          return;
        }

        const isUnchanged =
          targetSet.setId !== null &&
          targetSet.reps === targetSet.lastSyncedReps &&
          targetSet.weight === targetSet.lastSyncedWeight;

        if (isUnchanged) {
          return;
        }

        set((state) => ({
          exercises: replaceSet(state.exercises, exerciseLocalId, setLocalId, (item) => ({
            ...item,
            syncStatus: 'pending',
            lastError: null,
          })),
          unsyncedChanges: enqueueUniqueAction(state.unsyncedChanges, {
            id: createLocalId('sync'),
            type: 'save_set',
            exerciseLocalId,
            setLocalId,
            attempts: 0,
            nextAttemptAt: Date.now(),
          }),
        }));

        get().startRest();
        void get().processSyncQueue();
      },

      startRest: (seconds) => {
        const { restTimerEnabled, restDuration } = useSettingsStore.getState();
        if (!restTimerEnabled) {
          set({
            restStartedAt: null,
            restDurationSeconds: null,
          });
          return;
        }

        set({
          restStartedAt: Date.now(),
          restDurationSeconds: seconds ?? restDuration,
        });
      },

      stopRest: () =>
        set({
          restStartedAt: null,
          restDurationSeconds: null,
        }),

      discardWorkout: async () => {
        const current = get();
        if (current.workoutId) {
          set({
            ...emptySnapshot,
            unsyncedChanges: enqueueUniqueAction(current.unsyncedChanges, {
              id: createLocalId('sync'),
              type: 'discard_workout',
              workoutId: current.workoutId,
              attempts: 0,
              nextAttemptAt: Date.now(),
            }),
            error: null,
          });
          void get().processSyncQueue();
          return;
        }

        set({ ...emptySnapshot, error: null });
      },

      processSyncQueue: async () => {
        const current = get();
        if (current.isSyncing) {
          return;
        }

        clearQueueTimer();
        set({ isSyncing: true });

        try {
          while (true) {
            const next = get().unsyncedChanges[0];
            if (!next) {
              break;
            }

            if (next.nextAttemptAt > Date.now()) {
              scheduleRetry(next.nextAttemptAt);
              break;
            }

            try {
              await runQueueAction(next);
              set((state) => ({
                unsyncedChanges: state.unsyncedChanges.filter((item) => item.id !== next.id),
                error: null,
              }));
            } catch (error) {
              const message = getApiErrorMessage(error);
              logDebugError('workout.processSyncQueue', error);

              set((state) => {
                let exercises = state.exercises;

                if (next.type === 'add_exercise') {
                  exercises = markExerciseFailure(exercises, next.exerciseLocalId, message);
                }

                if (next.type === 'save_set') {
                  exercises = markSetFailure(
                    exercises,
                    next.exerciseLocalId,
                    next.setLocalId,
                    message,
                  );
                }

                return {
                  exercises,
                  error: message,
                  unsyncedChanges: state.unsyncedChanges.map((item) =>
                    item.id === next.id
                      ? {
                          ...item,
                          attempts: item.attempts + 1,
                          nextAttemptAt: Date.now() + RETRY_DELAY_MS,
                        }
                      : item,
                  ),
                };
              });

              useToastStore.getState().pushToast(message);
              scheduleRetry(Date.now() + RETRY_DELAY_MS);
              break;
            }
          }
        } finally {
          set({ isSyncing: false });
        }
      },

      reset: () => {
        clearQueueTimer();
        set({
          ...emptySnapshot,
          isLoading: false,
          isSyncing: false,
          error: null,
        });
      },
    }),
    {
      name: 'active-workout-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => getPersistedSnapshot(state),
    },
  ),
);
