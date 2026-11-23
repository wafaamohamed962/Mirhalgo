import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Award } from 'lucide-react';
import type { CompanyCard } from '@mirhalgo/shared';
import { Avatar, StarRating, buttonClasses } from '../../../components/ui';
import { newRequestFor } from '../requests/shared';
import { cn } from '../../../lib/utils';
import { useCompanyIdentity } from '../components/companyIdentity';

/** Directory card (spec B5): identity, badges, rating, stats, actions, select checkbox. */
export function CompanyCardView({
  company,
  selected,
  onToggle,
}: {
  company: CompanyCard;
  selected: boolean;
  /** Absent: the card cannot be selected. */
  onToggle?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { name, logoUrl } = useCompanyIdentity()(company);

  return (
    <article
      className={cn(
        'flex h-full flex-col gap-4 rounded-lg border-2 bg-white p-5 shadow-md transition-colors duration-150 ease-out',
        selected ? 'border-blue-600' : 'border-transparent',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={logoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="truncate font-semibold text-heading">
            {name}
          </h3>
          <StarRating value={company.rating} />
          <p className="text-caption text-muted">
            {t('portal.companies.reviews', {
              count: company.reviewsCount,
              formatted: company.reviewsCount.toLocaleString(i18n.language),
            })}
          </p>
        </div>
        {onToggle && (
          <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={t('portal.companies.select', { name })}
              className="size-5 accent-blue-600"
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {company.topRated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-caption font-semibold text-violet-600">
            <Award aria-hidden="true" className="size-3.5" />
            {t('portal.companies.topRated')}
          </span>
        )}
        {company.categories.map((category) => (
          <span
            key={category}
            className="rounded-full bg-blue-50 px-3 py-1 text-caption font-semibold text-blue-600"
          >
            {t(`portal.companies.categories.${category}`)}
          </span>
        ))}
      </div>
      <p className="text-small text-body">
        {t('portal.companies.completed', {
          count: company.completedOrders,
          formatted: company.completedOrders.toLocaleString(i18n.language),
        })}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Link
          to={`/app/companies/${company.id}`}
          className={buttonClasses({ variant: 'secondary', shape: 'form', className: 'px-3' })}
        >
          {t('portal.companies.viewProfile')}
        </Link>
        <Link
          to={newRequestFor([company.id])}
          className={buttonClasses({ shape: 'form', className: 'px-3' })}
        >
          {t('portal.companies.sendRequest')}
        </Link>
      </div>
    </article>
  );
}
