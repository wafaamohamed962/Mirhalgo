import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type AlertTone = 'success' | 'error' | 'info';

const TONES: Record<AlertTone, { box: string; icon: string; Icon: LucideIcon }> = {
  success: { box: 'border-success bg-white', icon: 'text-success', Icon: CircleCheck },
  error: { box: 'border-error bg-white', icon: 'text-error', Icon: CircleAlert },
  info: { box: 'border-blue-600 bg-blue-50', icon: 'text-blue-600', Icon: Info },
};

/** Inline message inside forms (announced by screen readers). Text stays body-colored for AA contrast. */
export function Alert({ tone = 'info', children }: { tone?: AlertTone; children: ReactNode }) {
  const { box, icon, Icon } = TONES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-sm border-s-4 p-4 text-small text-body shadow-sm',
        box,
      )}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', icon)} />
      <div>{children}</div>
    </div>
  );
}
