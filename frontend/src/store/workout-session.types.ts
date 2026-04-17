import type {
  ExerciseRead,
  WorkoutExerciseRead,
  WorkoutReadWithDetails,
  WorkoutSetRead,
} from '../api/workouts';

export type SyncStatus = 'synced' | 'pending' | 'failed';
export type WorkoutSessionStatus = 'draft' | 'active' | 'finished';
export type SyncQueueActionType =
  | 'add_exercise'
  | 'remove_exercise'
  | 'save_set'
  | 'reorder_exercises'
  | 'discard_workout'
  | 'finish_workout';

export interface WorkoutSessionSet {
  localId: string;
  setId: string | null;
  reps: string;
  weight: string;
  lastSyncedReps: string;
  lastSyncedWeight: string;
  syncStatus: SyncStatus;
  lastError: string | null;
}

export interface WorkoutSessionExercise {
  localId: string;
  workoutExerciseId: string | null;
  exerciseId: string;
  order: number;
  name: string;
  targetMuscleGroup: string | null;
  syncStatus: SyncStatus;
  lastError: string | null;
  sets: WorkoutSessionSet[];
}

interface SyncQueueBase {
  id: string;
  type: SyncQueueActionType;
  attempts: number;
  nextAttemptAt: number;
}

export interface AddExerciseQueueAction extends SyncQueueBase {
  type: 'add_exercise';
  exerciseLocalId: string;
}

export interface RemoveExerciseQueueAction extends SyncQueueBase {
  type: 'remove_exercise';
  workoutId: string;
  workoutExerciseId: string;
}

export interface SaveSetQueueAction extends SyncQueueBase {
  type: 'save_set';
  exerciseLocalId: string;
  setLocalId: string;
}

export interface ReorderExercisesQueueAction extends SyncQueueBase {
  type: 'reorder_exercises';
  workoutId: string;
}

export interface DiscardWorkoutQueueAction extends SyncQueueBase {
  type: 'discard_workout';
  workoutId: string;
}

export interface FinishWorkoutQueueAction extends SyncQueueBase {
  type: 'finish_workout';
  workoutId: string | null;
  finishedAt: string;
}

export type SyncQueueAction =
  | AddExerciseQueueAction
  | RemoveExerciseQueueAction
  | SaveSetQueueAction
  | ReorderExercisesQueueAction
  | DiscardWorkoutQueueAction
  | FinishWorkoutQueueAction;

export interface WorkoutSessionSnapshot {
  workoutId: string | null;
  status: WorkoutSessionStatus;
  startedAt: number | null;
  restStartedAt: number | null;
  restDurationSeconds: number | null;
  exercises: WorkoutSessionExercise[];
  unsyncedChanges: SyncQueueAction[];
}

export const createLocalId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createEmptyWorkoutSessionSnapshot = (): WorkoutSessionSnapshot => ({
  workoutId: null,
  status: 'draft',
  startedAt: null,
  restStartedAt: null,
  restDurationSeconds: null,
  exercises: [],
  unsyncedChanges: [],
});

export const createLocalSet = (
  overrides: Partial<WorkoutSessionSet> = {},
): WorkoutSessionSet => ({
  localId: createLocalId('set'),
  setId: null,
  reps: '',
  weight: '',
  lastSyncedReps: '',
  lastSyncedWeight: '',
  syncStatus: 'synced',
  lastError: null,
  ...overrides,
});

export const createLocalExercise = (
  exercise: ExerciseRead,
  order: number,
): WorkoutSessionExercise => ({
  localId: createLocalId('exercise'),
  workoutExerciseId: null,
  exerciseId: exercise.id,
  order,
  name: exercise.name,
  targetMuscleGroup: exercise.target_muscle_group,
  syncStatus: 'pending',
  lastError: null,
  sets: [],
});

const mapWorkoutSet = (set: WorkoutSetRead): WorkoutSessionSet =>
  createLocalSet({
    setId: set.id,
    reps: set.reps === null ? '' : String(set.reps),
    weight: set.weight === null ? '' : String(set.weight),
    lastSyncedReps: set.reps === null ? '' : String(set.reps),
    lastSyncedWeight: set.weight === null ? '' : String(set.weight),
    syncStatus: 'synced',
  });

const mapWorkoutExercise = (exercise: WorkoutExerciseRead): WorkoutSessionExercise => ({
  localId: createLocalId('exercise'),
  workoutExerciseId: exercise.id,
  exerciseId: exercise.exercise_id,
  order: exercise.order,
  name: exercise.exercise?.name ?? 'Упражнение',
  targetMuscleGroup: exercise.exercise?.target_muscle_group ?? null,
  syncStatus: 'synced',
  lastError: null,
  sets: exercise.sets.map(mapWorkoutSet),
});

export const mapWorkoutToSessionSnapshot = (
  workout: WorkoutReadWithDetails,
): WorkoutSessionSnapshot => ({
  workoutId: workout.id,
  status: workout.status === 'completed' ? 'finished' : 'active',
  startedAt: workout.start_time ? new Date(workout.start_time).getTime() : Date.now(),
  restStartedAt: null,
  restDurationSeconds: null,
  exercises: workout.workout_exercises.map(mapWorkoutExercise),
  unsyncedChanges: [],
});
