export function formatWorkoutDate(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(new Date(isoString));
}

export function formatWorkoutDateWithYear(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(isoString));
}

export function formatDuration(startIso: string, endIso: string): string {
  const diffSeconds = Math.max(
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000),
    0,
  );
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

export function formatWeekLabel(weekStartIso: string, timezone: string): string {
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const start = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).format(weekStart);
  const end = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).format(weekEnd);

  return `${start} – ${end}`;
}
