export type WorkoutMode = 'active' | 'history';

export interface WorkoutPermissions {
  canAddSet: boolean;
  canAddExercise: boolean;
  canFinish: boolean;
}

export function useWorkoutPermissions(mode: WorkoutMode): WorkoutPermissions {
  return {
    // Sets are editable in both modes per current requirements.
    // Change to `mode === 'active'` when history becomes read-only.
    canAddSet: true,
    // Adding exercises via catalog only makes sense during an active session.
    canAddExercise: mode === 'active',
    canFinish: mode === 'active',
  };
}
