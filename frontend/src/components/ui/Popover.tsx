import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Button + dropdown panel (bell, avatar menu). Closes on outside click, Escape (focus back
 * to the button) and when an item calls `close`.
 */
export function Popover({
  label,
  trigger,
  children,
  className,
}: {
  /** Accessible name of the trigger button. */
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    rootRef.current
      ?.querySelector<HTMLElement>('[data-popover-panel] a, [data-popover-panel] button')
      ?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="relative flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-1 text-heading hover:bg-slate-50"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          data-popover-panel
          className={cn(
            'absolute end-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-fade-in rounded-lg border border-slate-200 bg-white p-2 shadow-lg',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
