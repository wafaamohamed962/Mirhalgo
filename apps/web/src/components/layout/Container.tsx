import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Centered content, max-width 1200px (spec 2.5). */
export function Container({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-site px-4 sm:px-6', className)} {...rest} />;
}
