import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FaPerson, FaPersonDress } from 'react-icons/fa6';
import { ArrowLeft, FileClock, X } from 'lucide-react';
import { SERVICE_TYPES } from '@mirhalgo/shared';
import { Button, ProgressBar, QueryState, Skeleton, buttonClasses } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { cn } from '../../../lib/utils';
import { portalApi } from '../../../services/api/portal';
import {
  keys,
  useApiMutation,
  useAttempts,
  useCompanies,
  useMe,
  useRequestDraft,
} from '../../../services/api/queries';
import { useCompanyIdentity } from '../components/companyIdentity';
import { SERVICE_ICONS, useSelectedCompanies } from './shared';

function Welcome() {
  const { t } = useTranslation();
  const me = useMe();
  const Icon = me.data?.gender === 'female' ? FaPersonDress : FaPerson;
  return (
    <section className="flex items-center gap-4 rounded-lg bg-navy-900 p-6 text-on-dark sm:p-8">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <div className="min-w-0">
        {me.isPending ? (
          <Skeleton className="h-8 w-48 bg-white/20" />
        ) : (
          <h2 className="text-h2 text-white">
            {t('portal.newRequest.welcome', { name: me.data?.firstName ?? '' })}
          </h2>
        )}
        <p className="mt-1 text-on-dark-muted">{t('portal.newRequest.intro')}</p>
      </div>
    </section>
  );
}

function AttemptsCard() {
  const { t, i18n } = useTranslation();
  const attempts = useAttempts();
  return (
    <QueryState query={attempts} skeleton={<Skeleton className="h-28 rounded-lg" />}>
      {({ remaining, total }) => {
        const empty = remaining === 0;
        return (
          <section
            className={cn(
              'flex flex-col gap-3 rounded-lg border bg-white p-5 shadow-md',
              empty ? 'border-error' : 'border-slate-200',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-heading">
                {t('portal.attempts.remaining', {
                  remaining: remaining.toLocaleString(i18n.language),
                  total: total.toLocaleString(i18n.language),
                })}
              </h2>
              <Link to="/app/account/balance" className="text-small font-semibold">
                {t('portal.attempts.details')}
              </Link>
            </div>
            <ProgressBar
              value={(remaining / total) * 100}
              tone={empty ? 'error' : 'primary'}
              label={t('portal.attempts.label')}
            />
            {empty && (
              <p role="alert" className="text-small text-body">
                {t('portal.attempts.none')}
              </p>
            )}
          </section>
        );
      }}
    </QueryState>
  );
}

function DraftBanner() {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const draft = useRequestDraft();
  const discard = useApiMutation(portalApi.discardRequestDraft, {
    success: 'portal.newRequest.draftDiscarded',
    setData: keys.draft,
  });
  if (!draft.data) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-blue-600 bg-blue-50 p-5 sm:flex-row sm:items-center">
      <FileClock aria-hidden="true" className="size-6 shrink-0 text-blue-600" />
      <div className="flex-1">
        <h2 className="font-semibold text-heading">{t('portal.newRequest.draftTitle')}</h2>
        <p className="text-small text-body">
          {t('portal.newRequest.draftText', {
            service: t(`portal.services.${draft.data.service}.title`),
            date: formatDate(draft.data.updatedAt, true),
          })}
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          to={`/app/new-request/${draft.data.service}`}
          className={buttonClasses({ shape: 'form' })}
        >
          {t('portal.newRequest.continue')}
        </Link>
        <Button
          variant="secondary"
          shape="form"
          loading={discard.isPending}
          onClick={() => discard.mutate(undefined)}
        >
          {t('portal.newRequest.discard')}
        </Button>
      </div>
    </section>
  );
}

function SelectedCompanies() {
  const { t } = useTranslation();
  const { ids, remove } = useSelectedCompanies();
  const identity = useCompanyIdentity();
  const companies = useCompanies({ search: '', category: '', sort: 'top_rated' });
  if (ids.length === 0) return null;
  const selected = (companies.data ?? []).filter((c) => ids.includes(c.id));

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-small font-semibold text-heading">
        {t('portal.newRequest.sendingTo')}
      </span>
      {selected.map((company) => {
        const { name } = identity(company);
        return (
          <span
            key={company.id}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 ps-3 text-small font-semibold text-blue-600"
          >
            {name}
            <button
              type="button"
              onClick={() => remove(company.id)}
              aria-label={t('portal.newRequest.removeCompany', { name })}
              className="flex size-9 items-center justify-center rounded-full hover:bg-white"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </span>
        );
      })}
    </section>
  );
}

/** /app/new-request (spec B3). The service forms come in a later plan (placeholder pages). */
export default function NewRequestPage() {
  const { t } = useTranslation();
  const attempts = useAttempts();
  const { ids } = useSelectedCompanies();
  const blocked = attempts.data?.remaining === 0;
  const query = ids.length ? `?companies=${ids.join(',')}` : '';

  return (
    <div className="flex flex-col gap-6">
      <Welcome />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <DraftBanner />
          <SelectedCompanies />
        </div>
        <AttemptsCard />
      </div>

      <section aria-labelledby="services-title" className="flex flex-col gap-4">
        <h2 id="services-title" className="text-h3">
          {t('portal.newRequest.chooseService')}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {SERVICE_TYPES.map((service) => {
            const Icon = SERVICE_ICONS[service];
            return (
              <li key={service}>
                <Link
                  to={`/app/new-request/${service}${query}`}
                  aria-disabled={blocked || undefined}
                  onClick={(event) => blocked && event.preventDefault()}
                  className={cn(
                    'group flex h-full flex-col gap-3 rounded-lg bg-white p-6 no-underline shadow-md transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg',
                    blocked && 'pointer-events-none opacity-50',
                  )}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <span className="text-h3">{t(`portal.services.${service}.title`)}</span>
                  <span className="text-small text-body">
                    {t(`portal.services.${service}.text`)}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 text-small font-semibold text-link">
                    {t('portal.newRequest.start')}
                    <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
