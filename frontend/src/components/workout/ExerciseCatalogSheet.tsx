import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { exercisesApi } from '../../api/exercises';
import type { ExerciseRead } from '../../api/workouts';

interface ExerciseCatalogSheetProps {
  onSelect: (exercise: ExerciseRead) => void;
  onClose: () => void;
}

export function ExerciseCatalogSheet({ onSelect, onClose }: ExerciseCatalogSheetProps) {
  const [exercises, setExercises] = useState<ExerciseRead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    exercisesApi.getAll().then((data) => {
      setExercises(data);
      setLoading(false);
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

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-tg-theme-bg-color">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold">Выбор упражнения</h2>
        <button onClick={onClose} className="p-2 -mr-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-tg-theme-secondary-bg-color rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading && <p className="text-center text-tg-theme-hint-color mt-8">Загрузка...</p>}
        {!loading && Object.keys(groups).length === 0 && (
          <p className="text-center text-tg-theme-hint-color mt-8">Ничего не найдено</p>
        )}
        {Object.entries(groups).map(([group, exList]) => (
          <div key={group} className="mb-4">
            <p className="text-xs font-semibold text-tg-theme-hint-color uppercase tracking-wide mb-2">{group}</p>
            {exList.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full text-left px-4 py-3 rounded-xl bg-tg-theme-secondary-bg-color mb-1.5 active:scale-[0.98] transition-transform"
              >
                <p className="font-medium text-sm">{ex.name}</p>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
