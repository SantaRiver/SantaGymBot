import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { exercisesApi } from '../../api/exercises';
import type { ExerciseRead } from '../../api/workouts';
import { CreateExerciseModal } from './CreateExerciseModal';
import { Dialog } from '../ui/Dialog';
import { getUserFacingErrorMessage, logDebugError } from '../../utils/errors';

interface ExerciseCatalogSheetProps {
  onSelect: (exercise: ExerciseRead) => void;
  onClose: () => void;
}

export function ExerciseCatalogSheet({ onSelect, onClose }: ExerciseCatalogSheetProps) {
  const [exercises, setExercises] = useState<ExerciseRead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    exercisesApi
      .getAll()
      .then((data) => {
        setExercises(data);
        setLoading(false);
        setError(null);
      })
      .catch((loadError) => {
        logDebugError('exerciseCatalog.getAll', loadError);
        setLoading(false);
        setError(
          getUserFacingErrorMessage(
            loadError,
            'Не удалось загрузить каталог упражнений. Попробуйте ещё раз.',
          ),
        );
      });
  }, []);

  const groups = exercises
    .filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.target_muscle_group ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .reduce<Record<string, ExerciseRead[]>>((acc, ex) => {
      const group = ex.target_muscle_group ?? 'Другое';
      if (!acc[group]) acc[group] = [];
      acc[group].push(ex);
      return acc;
    }, {});

  const handleCreated = (exercise: ExerciseRead) => {
    setExercises((prev) => [...prev, exercise].sort((a, b) => a.name.localeCompare(b.name)));
    setCreateOpen(false);
    onSelect(exercise);
  };

  const handleUseExisting = (exercise: ExerciseRead) => {
    setCreateOpen(false);
    onSelect(exercise);
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title="Выбор упражнения"
        description="Найдите упражнение в каталоге или создайте своё."
        variant="fullscreen"
        closeLabel="Закрыть каталог упражнений"
        bodyClassName="flex min-h-0 flex-1 flex-col"
        contentClassName="max-w-none"
      >
        <div className="px-4 pb-3">
          <input
            type="text"
            placeholder="Поиск..."
            aria-label="Поиск упражнения"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-tg-theme-secondary-bg-color rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          />
        </div>

        <div className="px-4 pb-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-tg-theme-button-color/40 bg-tg-theme-secondary-bg-color px-4 py-3 text-sm font-medium text-tg-theme-button-color"
          >
            <Plus className="h-4 w-4" />
            Создать своё упражнение
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/15 bg-red-500/5 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}
          {loading && <p className="text-center text-tg-theme-hint-color mt-8">Загрузка...</p>}
          {!loading && !error && Object.keys(groups).length === 0 && (
            <p className="text-center text-tg-theme-hint-color mt-8">Ничего не найдено</p>
          )}
          {!error && Object.entries(groups).map(([group, exList]) => (
            <div key={group} className="mb-4">
              <p className="text-xs font-semibold text-tg-theme-hint-color uppercase tracking-wide mb-2">{group}</p>
              {exList.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="mb-1.5 w-full rounded-xl bg-tg-theme-secondary-bg-color px-4 py-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-sm">{ex.name}</p>
                    <span className="text-[11px] uppercase tracking-wide text-tg-theme-hint-color">
                      {ex.visibility === 'private' ? 'Моё' : 'Системное'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Dialog>
      {createOpen && (
        <CreateExerciseModal
          initialName={search}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
          onUseExisting={handleUseExisting}
        />
      )}
    </>
  );
}
