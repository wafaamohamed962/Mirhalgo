import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'accent' | 'accentSoft' | 'chip';

const VARIANTS: Record<BadgeVariant, string> = {
  /** Violet pill on images ("Most requested"). */
  accent: 'bg-violet-600 text-white',
  /** Light violet (eyebrows, soft highlights). */
  accentSoft: 'bg-violet-100 text-violet-600',
  /** Tag chip: blue-50 background, blue-600 text (spec 3.4). */
  chip: 'bg-blue-50 text-blue-600',
};

export function Badge({
  variant = 'accent',
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-caption font-semibold',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
