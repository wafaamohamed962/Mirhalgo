import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../../../components/ui';

/** "جديد" on an item the company has not opened yet (spec B2). */
export function NewBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 text-caption font-semibold text-white">
      {t('companyPortal.new')}
    </span>
  );
}

/**
 * The top of every company section: Back (all sections but Overview, spec B2), the title and
 * an optional explanatory note.
 */
export function CompanyPageHeader({
  title,
  back = true,
  note,
  actions,
}: {
  title: string;
  back?: boolean;
  note?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {back && <BackButton />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2">{title}</h1>
        {actions}
      </div>
      {note && <p className="max-w-3xl text-small text-muted">{note}</p>}
    </div>
  );
}
