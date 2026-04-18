import { useToastStore } from '../store/toast';

export function ToastViewport() {
  const items = useToastStore((state) => state.items);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-4 z-50 mx-auto flex max-w-md flex-col gap-2"
      style={{ top: 'calc(var(--app-safe-top) + 1rem)' }}
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className="rounded-2xl border border-red-500/20 bg-tg-theme-bg-color px-4 py-3 text-sm text-tg-theme-text-color shadow-xl"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
