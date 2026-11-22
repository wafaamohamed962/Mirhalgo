import { cn } from '../../lib/utils';

/** Determinate progress (0–100). `label` is the accessible name. */
export function ProgressBar({
  value,
  label,
  tone = 'primary',
  className,
}: {
  value: number;
  label: string;
  tone?: 'primary' | 'error';
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out',
          tone === 'error' ? 'bg-error' : 'bg-blue-600',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
