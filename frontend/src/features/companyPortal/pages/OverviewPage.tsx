import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Clock,
  EyeOff,
  FileCheck2,
  FileX2,
  Inbox,
  KeyRound,
  MessageSquare,
  PackageCheck,
  Phone,
  Send,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type {
  ActivityEntry,
  CompanyDashboard,
  CompanyInquiry,
  CompanyKpis,
  CompanyOffer,
  CompanyRequest,
} from '@mirhalgo/shared';
import {
  Alert,
  EmptyState,
  QueryState,
  Skeleton,
  buttonClasses,
  cardClasses,
} from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { cn } from '../../../lib/utils';
import { useCompanyAccount, useCompanyDashboard } from '../../../services/api/companyQueries';
import { CategoryChip, CategoryIcon } from '../categories';
import { categoryStripe } from '../categoryLook';
import { formatNumber, useOfferTotal } from '../companyFormat';
import { CompanyPageHeader, NewBadge } from '../components/common';
import { InquiryStatusBadge, OfferStatusBadge } from '../components/StatusBadges';
import { useSeen } from '../seen';

/*
 * Overview (MW_004 spec B3): 6 KPI cards, requests awaiting our offer (max 8), our latest
 * offers (5), inquiries awaiting reply, and the account activity, newest first. Every block
 * has its own empty state. One request (GET /company/dashboard) feeds the page and the badges.
 */

const KPIS: Array<{ key: keyof CompanyKpis; icon: LucideIcon }> = [
  { key: 'offersSubmitted', icon: Send },
  { key: 'offersAccepted', icon: FileCheck2 },
  { key: 'offersRejected', icon: FileX2 },
  { key: 'completedOrders', icon: PackageCheck },
  { key: 'avgResponseHours', icon: Timer },
  { key: 'onTimeRate', icon: Clock },
];

function KpiCards({ kpis }: { kpis: CompanyKpis }) {
  const { t } = useTranslation();
  // a big number and a small unit (a unit at number size wrapped under it)
  const units: Partial<Record<keyof CompanyKpis, string>> = {
    avgResponseHours: t('companyPortal.overview.hoursUnit'),
    onTimeRate: '%',
  };
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {KPIS.map(({ key, icon: Icon }) => (
        <div key={key} className={cardClasses({ className: 'flex flex-col gap-2 p-4' })}>
          <dt className="flex items-center gap-2 text-small text-muted">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-blue-600" />
            {t(`companyPortal.overview.kpis.${key}`)}
          </dt>
          <dd className="flex items-baseline gap-1 text-heading">
            <span dir="ltr" className="text-h2">
              {formatNumber(kpis[key])}
            </span>
            {kpis[key] !== null && units[key] && (
              <span className="text-small text-muted">{units[key]}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled card with an optional "View all" link (spec B3). */
function Block({
  title,
  viewAll,
  children,
}: {
  title: string;
  viewAll?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={cardClasses({ className: 'flex flex-col gap-4 p-5' })} aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        {viewAll && (
          <Link to={viewAll} className="text-small font-semibold whitespace-nowrap">
            {t('companyPortal.overview.viewAll')}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const ROW = 'flex flex-wrap items-center gap-3 rounded-sm border border-slate-200 bg-white p-3';

function AwaitingOffer({
  requests,
  suspended,
}: {
  requests: CompanyRequest[];
  suspended: boolean;
}) {
  const { t } = useTranslation();
  const { isNew } = useSeen();
  const { formatDate } = useDateFormat();
  return (
    <Block title={t('companyPortal.overview.awaitingOffer.title')} viewAll="/company/requests">
      {suspended && <Alert tone="info">{t('companyPortal.suspended')}</Alert>}
      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title={t('companyPortal.overview.awaitingOffer.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className={cn(ROW, categoryStripe(request.category))}>
              <CategoryIcon category={request.category} />
              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/company/requests?order=${request.id}`}
                    dir="ltr"
                    className="font-semibold whitespace-nowrap text-heading"
                  >
                    {request.id}
                  </Link>
                  {isNew('request', request.id) && <NewBadge />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
                  <CategoryChip category={request.category} />
                  <span>{formatDate(request.createdAt)}</span>
                </div>
              </div>
              {suspended ? (
                <button
                  type="button"
                  disabled
                  className={buttonClasses({
                    variant: 'secondary',
                    shape: 'form',
                    className: 'h-11 px-4 text-small',
                  })}
                >
                  {t('companyPortal.submitOffer')}
                </button>
              ) : (
                <Link
                  to={`/company/requests?order=${request.id}&offer=new`}
                  className={buttonClasses({ shape: 'form', className: 'h-11 px-4 text-small' })}
                  aria-label={t('companyPortal.submitOfferFor', { id: request.id })}
                >
                  {t('companyPortal.submitOffer')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function LatestOffers({ offers }: { offers: CompanyOffer[] }) {
  const { t } = useTranslation();
  const total = useOfferTotal();
  return (
    <Block title={t('companyPortal.overview.latestOffers.title')} viewAll="/company/offers">
      {offers.length === 0 ? (
        <EmptyState icon={Send} title={t('companyPortal.overview.latestOffers.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((offer) => (
            <li key={offer.id} className={cn(ROW, categoryStripe(offer.category))}>
              <CategoryIcon category={offer.category} />
              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                <Link
                  to={`/company/offers?search=${offer.id}`}
                  dir="ltr"
                  className="font-semibold whitespace-nowrap text-heading rtl:text-end"
                >
                  {offer.id}
                </Link>
                <span className="text-caption text-muted">
                  {t('companyPortal.onOrder', { id: offer.orderId })}
                </span>
              </div>
              <span dir="auto" className="text-small font-semibold text-heading">
                {total(offer.total)}
              </span>
              <OfferStatusBadge status={offer.status} />
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function AwaitingInquiries({ inquiries }: { inquiries: CompanyInquiry[] }) {
  const { t } = useTranslation();
  const { isNew } = useSeen();
  const { formatDate } = useDateFormat();
  return (
    <Block title={t('companyPortal.overview.inquiries.title')} viewAll="/company/inquiries">
      {inquiries.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('companyPortal.overview.inquiries.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className={cn(ROW, categoryStripe(inquiry.category))}>
              <CategoryIcon category={inquiry.category} />
              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/company/inquiries?inquiry=${inquiry.id}`}
                    dir="ltr"
                    className="font-semibold whitespace-nowrap text-heading"
                  >
                    {inquiry.id}
                  </Link>
                  {isNew('inquiry', inquiry.id) && <NewBadge />}
                  <InquiryStatusBadge status={inquiry.status} />
                </div>
                {/* user content: plain text, clipped (spec B10: never raw HTML) */}
                <p className="line-clamp-2 text-small text-body">{inquiry.question}</p>
                <span className="text-caption text-muted">
                  {t('companyPortal.onOrder', { id: inquiry.orderId })} ·{' '}
                  {formatDate(inquiry.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

const ACTIVITY_ICONS: Record<ActivityEntry['type'], LucideIcon> = {
  offer_submitted: Send,
  offer_updated: FileCheck2,
  offer_accepted: CheckCircle2,
  offer_rejected: FileX2,
  inquiry_received: MessageSquare,
  inquiry_replied: MessageSquare,
  request_assigned: Inbox,
  privacy_changed: EyeOff,
  contact_updated: Phone,
  password_changed: KeyRound,
};

function Activity({ entries }: { entries: ActivityEntry[] }) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const text = (entry: ActivityEntry) =>
    entry.type === 'privacy_changed'
      ? t(`companyPortal.activity.privacy_${entry.hideOffers ? 'on' : 'off'}`)
      : t(`companyPortal.activity.${entry.type}`, {
          orderId: entry.orderId,
          offerId: entry.offerId,
          inquiryId: entry.inquiryId,
        });
  return (
    <Block title={t('companyPortal.overview.activity.title')}>
      {entries.length === 0 ? (
        <EmptyState icon={Clock} title={t('companyPortal.overview.activity.empty')} />
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => {
            const Icon = ACTIVITY_ICONS[entry.type];
            return (
              <li key={entry.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-small text-body">{text(entry)}</span>
                  <time dateTime={entry.at} className="text-caption text-muted">
                    {formatDate(entry.at, true)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Block>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function Overview({ data, suspended }: { data: CompanyDashboard; suspended: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <KpiCards kpis={data.kpis} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AwaitingOffer requests={data.awaitingOffer} suspended={suspended} />
        <LatestOffers offers={data.latestOffers} />
        <AwaitingInquiries inquiries={data.awaitingInquiries} />
        <Activity entries={data.activity} />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { t } = useTranslation();
  const dashboard = useCompanyDashboard();
  const suspended = useCompanyAccount().data?.offerSubmission === 'suspended';
  return (
    <>
      <CompanyPageHeader title={t('companyPortal.nav.overview')} back={false} />
      <QueryState query={dashboard} skeleton={<OverviewSkeleton />}>
        {(data) => <Overview data={data} suspended={suspended} />}
      </QueryState>
    </>
  );
}
