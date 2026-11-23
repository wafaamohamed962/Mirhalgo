import 'flag-icons/css/flag-icons.min.css';
import { cn } from '../../lib/utils';

/**
 * Country flag from `flag-icons` (SVG, MIT; approved for MW_003): Windows does not render
 * flag emoji. Only the flags that are shown get downloaded. Decorative: the country name is
 * always shown next to it.
 */
export function Flag({ code, className }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(`fi fi-${code.toLowerCase()}`, 'shrink-0 shadow-sm', className)}
    />
  );
}
