import { useEffect, useState } from 'react';
import { LoaderCircle, Plus, Search, X } from 'lucide-react';

import { exercisesApi } from '../../api/exercises';
import type { ExerciseCreate, ExerciseRead, ExerciseSimilar } from '../../api/workouts';

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
    } catch (err: any) {
      setError(err.response?.data?.detail ?? err.message ?? 'Не удалось проверить похожие упражнения');
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
    } catch (err: any) {
      setError(err.response?.data?.detail ?? err.message ?? 'Не удалось создать упражнение');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45">
      <div className="w-full rounded-t-3xl bg-tg-theme-bg-color px-4 pb-6 pt-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Новое упражнение</h3>
            <p className="text-sm text-tg-theme-hint-color">Проверим дубликаты перед созданием</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2">
            <X className="h-5 w-5" />
          </button>
        </div>

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

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {hasChecked && (
          <div className="mt-4">
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
      </div>
    </div>
  );
}
