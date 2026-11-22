import { cn } from '../../lib/utils';

/*
 * Class recipes shared by the UI kit, so links styled as buttons and every form
 * control look identical (spec 2.3, 2.5). Tokens only, no hard-coded values.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'onDark' | 'ghost' | 'danger';
/** `pill` for CTAs, `form` (12px radius) inside forms. */
export type ButtonShape = 'pill' | 'form';

const BUTTON_BASE =
  'inline-flex h-(--btn-height) shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap px-6 text-base font-semibold no-underline transition duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg active:translate-y-0 active:bg-blue-800',
  secondary: 'border-2 border-blue-600 bg-transparent text-blue-600 hover:bg-blue-50',
  onDark: 'border-2 border-white bg-transparent text-white hover:bg-white/10',
  ghost: 'bg-transparent px-2 text-blue-600 hover:underline',
  danger: 'bg-error text-white hover:bg-error-hover',
};

export function buttonClasses({
  variant = 'primary',
  shape = 'pill',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    shape === 'pill' ? 'rounded-full' : 'rounded-sm',
    fullWidth && 'w-full',
    className,
  );
}

/** Text inputs, selects and textareas. */
export function controlClasses(invalid: boolean, className?: string): string {
  return cn(
    'w-full rounded-sm border bg-white px-4 text-base text-heading shadow-sm transition-colors duration-150 ease-out placeholder:text-muted focus:border-blue-600 focus:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50',
    invalid ? 'border-error' : 'border-slate-200',
    className,
  );
}

export function cardClasses({
  interactive = false,
  className,
}: { interactive?: boolean; className?: string } = {}): string {
  return cn(
    'rounded-lg bg-white shadow-md',
    interactive && 'transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg',
    className,
  );
}
