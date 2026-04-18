import {
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { X } from 'lucide-react';

type DialogVariant = 'sheet' | 'fullscreen';

interface DialogProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: DialogVariant;
  footer?: ReactNode;
  closeLabel?: string;
  contentClassName?: string;
  bodyClassName?: string;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const variantClasses: Record<DialogVariant, string> = {
  sheet:
    'mt-auto w-full max-w-md rounded-t-3xl bg-tg-theme-bg-color px-4 pb-[calc(1.5rem+var(--app-safe-bottom))] pt-4 shadow-2xl',
  fullscreen: 'flex h-full min-h-0 w-full flex-col overflow-hidden bg-tg-theme-bg-color',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  variant = 'sheet',
  footer,
  closeLabel = 'Закрыть диалог',
  contentClassName = '',
  bodyClassName = '',
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const labelledBy = useMemo(() => titleId, [titleId]);
  const describedBy = description ? descriptionId : undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = window.setTimeout(() => {
      const root = containerRef.current;
      if (!root) {
        return;
      }

      const focusable = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const root = containerRef.current;
      if (!root) {
        return;
      }

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute('aria-hidden'));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const overlayStyle = variant === 'fullscreen'
    ? {
        paddingTop: 'var(--app-safe-top)',
        paddingRight: 'var(--app-safe-right)',
        paddingBottom: 'var(--app-safe-bottom)',
        paddingLeft: 'var(--app-safe-left)',
      }
    : undefined;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex bg-black/45 ${variant === 'fullscreen' ? '' : 'items-end'}`}
      style={overlayStyle}
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`${variantClasses[variant]} ${contentClassName}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4 px-4 sm:px-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-tg-theme-hint-color">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-full p-2 text-tg-theme-text-color transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tg-theme-button-color"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer ? <div className="mt-4 px-4 sm:px-0">{footer}</div> : null}
      </div>
    </div>
  );
}
