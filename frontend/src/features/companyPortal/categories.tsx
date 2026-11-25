import { useTranslation } from 'react-i18next';
import type { ServiceCategory } from '@mirhalgo/shared';
import { cn } from '../../lib/utils';
import { CATEGORY_LOOK } from './categoryLook';

/** The icon tile at the start of a row. Decorative: the chip or the text names the category. */
export function CategoryIcon({
  category,
  className,
}: {
  category: ServiceCategory;
  className?: string;
}) {
  const { icon: Icon, tone } = CATEGORY_LOOK[category];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-sm',
        tone,
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/** The service chip ("Sea freight & customs"). */
export function CategoryChip({ category }: { category: ServiceCategory }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-caption font-semibold whitespace-nowrap',
        CATEGORY_LOOK[category].tone,
      )}
    >
      {t(`companyPortal.categories.${category}`)}
    </span>
  );
}
