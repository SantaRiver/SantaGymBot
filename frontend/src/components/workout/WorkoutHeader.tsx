import { ArrowLeft, Grip, StopCircle, Timer } from 'lucide-react';
import type { WorkoutReadWithDetails } from '../../api/workouts';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(startIso: string, endIso: string): string {
  const diffSeconds = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

interface ActiveHeaderProps {
  elapsedSeconds: number;
  onFinish: () => void;
  finishing: boolean;
  canManage: boolean;
  isManaging: boolean;
  onToggleManage: () => void;
}

function ActiveHeader({
  elapsedSeconds,
  onFinish,
  finishing,
  canManage,
  isManaging,
  onToggleManage,
}: ActiveHeaderProps) {
  return (
    <header className="mb-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Тренировка</h1>
          <p className="text-tg-theme-hint-color text-sm flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            {formatTime(elapsedSeconds)}
          </p>
        </div>
        <button
          onClick={onFinish}
          disabled={finishing}
          className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          <StopCircle className="w-4 h-4" />
          Завершить
        </button>
      </div>

      {canManage && (
        <div className="mt-3">
          <button
            onClick={onToggleManage}
            className="flex items-center gap-2 rounded-xl bg-tg-theme-secondary-bg-color px-4 py-2.5 text-sm font-medium active:scale-95 transition-transform"
          >
            <Grip className="w-4 h-4 text-tg-theme-hint-color" />
            {isManaging ? 'Готово' : 'Управлять упражнениями'}
          </button>
        </div>
      )}
    </header>
  );
}

interface HistoryHeaderProps {
  workout: WorkoutReadWithDetails;
  onBack: () => void;
}

function HistoryHeader({ workout, onBack }: HistoryHeaderProps) {
  const date = workout.start_time ? formatDate(workout.start_time) : 'Дата неизвестна';
  const duration =
    workout.start_time && workout.end_time
      ? formatDuration(workout.start_time, workout.end_time)
      : null;

  return (
    <header className="flex justify-between items-center mb-6 pt-4">
      <div>
        <h1 className="text-xl font-bold">Тренировка</h1>
        <p className="text-tg-theme-hint-color text-sm">{date}</p>
        {duration && <p className="text-tg-theme-hint-color text-xs">{duration}</p>}
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 bg-tg-theme-secondary-bg-color text-tg-theme-text-color px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад
      </button>
    </header>
  );
}

type WorkoutHeaderProps =
  | ({ mode: 'active' } & ActiveHeaderProps)
  | ({ mode: 'history' } & HistoryHeaderProps);

export function WorkoutHeader(props: WorkoutHeaderProps) {
  if (props.mode === 'active') {
    return (
      <ActiveHeader
        elapsedSeconds={props.elapsedSeconds}
        onFinish={props.onFinish}
        finishing={props.finishing}
        canManage={props.canManage}
        isManaging={props.isManaging}
        onToggleManage={props.onToggleManage}
      />
    );
  }
  return <HistoryHeader workout={props.workout} onBack={props.onBack} />;
}
