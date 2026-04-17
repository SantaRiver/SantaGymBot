import { useEffect, useState } from 'react';
import { LoaderCircle, Plus, Search } from 'lucide-react';

import { exercisesApi } from '../../api/exercises';
import type { ExerciseCreate, ExerciseRead, ExerciseSimilar } from '../../api/workouts';
import { Dialog } from '../ui/Dialog';
import { getUserFacingErrorMessage, logDebugError } from '../../utils/errors';

interface CreateExerciseModalProps {
  initialName: string;
  onClose: () => void;
  onCreated: (exercise: ExerciseRead) => void;
  onUseExisting: (exercise: ExerciseRead) => void;
}

export function CreateExerciseModal({
  initialName,
  onClose,
  onCreated,
  onUseExisting,
}: CreateExerciseModalProps) {
  const [name, setName] = useState(initialName.trim());
  const [targetMuscleGroup, setTargetMuscleGroup] = useState('');
  const [matches, setMatches] = useState<ExerciseSimilar[]>([]);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    setName(initialName.trim());
  }, [initialName]);

  const handleCheck = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название упражнения');
      setMatches([]);
      setHasChecked(false);
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const response = await exercisesApi.getSimilar(trimmed);
      setMatches(response.matches);
      setHasChecked(true);
    } catch (error: unknown) {
      logDebugError('createExercise.check', error);
      setError(
        getUserFacingErrorMessage(
          error,
          'Не удалось проверить похожие упражнения. Попробуйте ещё раз.',
        ),
      );
    } finally {
      setChecking(false);
    }
  };

  const handleCreate = async () => {
    const payload: ExerciseCreate = {
      name: name.trim(),
      target_muscle_group: targetMuscleGroup.trim() || undefined,
    };
    if (!payload.name) {
      setError('Введите название упражнения');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await exercisesApi.create(payload);
      onCreated(created);
    } catch (error: unknown) {
      logDebugError('createExercise.create', error);
      setError(
        getUserFacingErrorMessage(
          error,
          'Не удалось создать упражнение. Попробуйте ещё раз.',
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Новое упражнение"
      description="Проверим дубликаты перед созданием."
      closeLabel="Закрыть создание упражнения"
      bodyClassName="space-y-3 px-4 sm:px-0"
    >
      <div className="space-y-3">
          <input
            type="text"
            placeholder="Название упражнения"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChecked(false);
              setMatches([]);
            }}
            className="w-full rounded-2xl bg-tg-theme-secondary-bg-color px-4 py-3 text-sm focus:outline-none"
          />

          <input
            type="text"
            placeholder="Группа мышц (необязательно)"
            value={targetMuscleGroup}
            onChange={(e) => setTargetMuscleGroup(e.target.value)}
            className="w-full rounded-2xl bg-tg-theme-secondary-bg-color px-4 py-3 text-sm focus:outline-none"
          />

          <button
            onClick={handleCheck}
            disabled={checking || creating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tg-theme-button-color px-4 py-3 text-sm font-medium text-tg-theme-button-text-color disabled:opacity-60"
          >
            {checking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Найти похожие
          </button>
      </div>

      {error && <p className="mt-3 px-4 text-sm text-red-500 sm:px-0">{error}</p>}

      {hasChecked && (
        <div className="mt-4 px-4 sm:px-0">
            {matches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Похожие упражнения</p>
                {matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() =>
                      onUseExisting({
                        id: match.id,
                        name: match.name,
                        target_muscle_group: match.target_muscle_group,
                        user_id: null,
                        visibility: match.visibility,
                        created_at: '',
                      })
                    }
                    className="w-full rounded-2xl bg-tg-theme-secondary-bg-color px-4 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{match.name}</p>
                        <p className="text-xs text-tg-theme-hint-color">
                          {[match.target_muscle_group, match.visibility === 'system' ? 'Системное' : 'Моё']
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                      <span className="text-xs text-tg-theme-hint-color">
                        {Math.round(match.similarity * 100)}%
                      </span>
                    </div>
                  </button>
                ))}

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-tg-theme-button-color px-4 py-3 text-sm font-medium text-tg-theme-button-color disabled:opacity-60"
                >
                  {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Создать все равно
                </button>
              </div>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tg-theme-button-color px-4 py-3 text-sm font-medium text-tg-theme-button-text-color disabled:opacity-60"
              >
                {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Создать упражнение
              </button>
            )}
        </div>
      )}
    </Dialog>
  );
}
