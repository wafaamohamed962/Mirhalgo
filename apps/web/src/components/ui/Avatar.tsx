import { cn } from '../../lib/utils';

const SIZES = { sm: 'size-9 text-small', md: 'size-12 text-base', lg: 'size-20 text-h3' } as const;

/** Picture or initials (first letters of the first two words). Decorative: label it nearby. */
export function Avatar({
  name,
  src,
  size = 'sm',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return src ? (
    <img
      src={src}
      alt=""
      className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white',
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
