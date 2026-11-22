import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/** Titled group of fields inside a wizard step (two columns from `sm`). */
export function FormSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-h3">{title}</h2>
      <div className={cn('grid gap-5 sm:grid-cols-2', className)}>{children}</div>
    </section>
  );
}

/** Spans both columns of a FormSection. */
export function Full({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}
