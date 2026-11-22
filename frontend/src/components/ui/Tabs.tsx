import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export type TabItem<V extends string> = { value: V; label: ReactNode; count?: number };

/**
 * WAI-ARIA tabs (roving tabindex, arrow keys, Home/End). Controlled: the parent renders the
 * panel with `tabPanelProps(id, value)` (tabPanel.ts) so the panel is labelled by its tab.
 */
export function Tabs<V extends string>({
  id,
  label,
  items,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  items: ReadonlyArray<TabItem<V>>;
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();

  const onKeyDown = (event: KeyboardEvent) => {
    const index = items.findIndex((item) => item.value === value);
    const rtl = document.documentElement.dir === 'rtl';
    const step: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
    };
    let next: number | null = null;
    if (event.key in step) next = (index + step[event.key]! + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next]!.value);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn('flex gap-1 overflow-x-auto border-b border-slate-200', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${id}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={onKeyDown}
            className={cn(
              '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-small font-semibold whitespace-nowrap transition-colors duration-150 ease-out',
              selected
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted hover:text-heading',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 text-caption',
                  selected ? 'bg-blue-600 text-white' : 'bg-slate-50 text-muted',
                )}
              >
                {item.count.toLocaleString(i18n.language)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
