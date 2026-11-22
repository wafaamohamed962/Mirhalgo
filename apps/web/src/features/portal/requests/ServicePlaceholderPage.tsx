import { Link, Navigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { SERVICE_TYPES, type ServiceType } from '@mirhalgo/shared';
import { buttonClasses } from '../../../components/ui';
import { SERVICE_ICONS, useSelectedCompanies } from './shared';

/** /app/new-request/:service: placeholder until the service forms exist (spec B3). */
export default function ServicePlaceholderPage() {
  const { t, i18n } = useTranslation();
  const { service } = useParams();
  const { ids } = useSelectedCompanies();
  if (!SERVICE_TYPES.includes(service as ServiceType))
    return <Navigate to="/app/new-request" replace />;
  const Icon = SERVICE_ICONS[service as ServiceType];

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg bg-white p-8 text-center shadow-md">
      <span className="flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon aria-hidden="true" className="size-8" />
      </span>
      <h2 className="text-h2">{t(`portal.services.${service}.title`)}</h2>
      <p className="inline-flex items-center gap-2 text-small font-semibold text-violet-600">
        <Clock aria-hidden="true" className="size-4" />
        {t('contact.comingSoon')}
      </p>
      <p className="text-body">{t('portal.newRequest.placeholder')}</p>
      {ids.length > 0 && (
        <p className="text-small text-muted">
          {t('portal.newRequest.selectedCount', {
            count: ids.length,
            formatted: ids.length.toLocaleString(i18n.language),
          })}
        </p>
      )}
      <Link to="/app/new-request" className={buttonClasses({ variant: 'secondary' })}>
        {t('portal.newRequest.back')}
      </Link>
    </section>
  );
}
