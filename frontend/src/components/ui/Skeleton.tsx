import { cn } from '../../lib/utils';

/** Loading placeholder block (spec B1: every page shows skeletons while loading). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-sm bg-slate-200 motion-reduce:animate-none', className)}
    />
  );
}

/** A stack of card-shaped skeletons. */
export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('h-28 rounded-lg', className)} />
      ))}
    </div>
  );
}
