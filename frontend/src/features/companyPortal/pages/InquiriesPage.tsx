import { useTranslation } from 'react-i18next';
import { MessageSquare, SearchX } from 'lucide-react';
import { INQUIRY_STATUSES, type CompanyInquiry } from '@mirhalgo/shared';
import { Alert, Button, EmptyState, QueryState, Tabs } from '../../../components/ui';
import { tabPanelProps } from '../../../components/ui/tabPanel';
import { useDateFormat } from '../../../lib/dateFormat';
import { normalizeSearch } from '../../../lib/search';
import { useQueryParam, useQuerySearch } from '../../../lib/useUrlState';
import { cn } from '../../../lib/utils';
import { useCompanyInquiries } from '../../../services/api/companyQueries';
import { CategoryIcon } from '../categories';
import { categoryStripe } from '../categoryLook';
import { CompanyPageHeader, NewBadge } from '../components/common';
import { SearchBox } from '../components/SearchBox';
import { InquiryStatusBadge } from '../components/StatusBadges';
import { InquiryModal } from '../inquiries/InquiryModal';
import { useSeen } from '../seen';
import { useUrlModals } from '../urlModal';

/*
 * Client inquiries (MW_004 spec B8): every inquiry is linked to its order and our offer on
 * it. Filter by status and search by order id or inquiry id (both in the URL), newest first.
 * The inquiry opens in a modal (?inquiry=IQ-…).
 */

const FILTERS = ['all', ...INQUIRY_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

function InquiryCard({ inquiry, onOpen }: { inquiry: CompanyInquiry; onOpen: () => void }) {
  const { t } = useTranslation();
  const { isNew } = useSeen();
  const { formatDate } = useDateFormat();
  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-white p-4',
        categoryStripe(inquiry.category),
      )}
    >
      <CategoryIcon category={inquiry.category} />
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="font-semibold whitespace-nowrap text-heading">
            {inquiry.id}
          </span>
          {isNew('inquiry', inquiry.id) && <NewBadge />}
          <InquiryStatusBadge status={inquiry.status} />
        </div>
        <p dir="auto" className="line-clamp-2 text-small text-body">
          {inquiry.question}
        </p>
        <span className="text-caption text-muted">
          {t('companyPortal.onOrder', { id: inquiry.orderId })} · {formatDate(inquiry.createdAt)}
        </span>
      </div>
      <Button
        variant="secondary"
        shape="form"
        className="h-11 px-4 text-small"
        onClick={onOpen}
        aria-label={t('companyPortal.inquiries.openFor', { id: inquiry.id })}
      >
        {t('companyPortal.inquiries.open')}
      </Button>
    </li>
  );
}

export default function InquiriesPage() {
  const { t } = useTranslation();
  const inquiries = useCompanyInquiries();
  const [filter, setFilter] = useQueryParam<Filter>('status', 'all', FILTERS);
  const { input, setInput, search } = useQuerySearch('search');
  const { params, open, close } = useUrlModals();
  const openId = params.get('inquiry');
  const opened = inquiries.data?.find((inquiry) => inquiry.id === openId);
  const query = normalizeSearch(search);

  return (
    <>
      <CompanyPageHeader
        title={t('companyPortal.nav.inquiries')}
        note={t('companyPortal.inquiries.note')}
      />
      {openId && inquiries.data && !opened && (
        <div className="mb-5">
          <Alert tone="error">{t('errors.NOT_FOUND')}</Alert>
        </div>
      )}
      <QueryState
        query={inquiries}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon={MessageSquare} title={t('companyPortal.inquiries.empty')} />}
      >
        {(data) => {
          const shown = data.filter(
            (inquiry) =>
              (filter === 'all' || inquiry.status === filter) &&
              (!query ||
                normalizeSearch(inquiry.id).includes(query) ||
                normalizeSearch(inquiry.orderId).includes(query)),
          );
          return (
            <div className="flex flex-col gap-5">
              <SearchBox
                id="inquiries-search"
                label={t('companyPortal.inquiries.search')}
                placeholder={t('companyPortal.inquiries.searchPlaceholder')}
                value={input}
                onChange={setInput}
              />
              <Tabs
                id="inquiries"
                label={t('companyPortal.inquiries.filterLabel')}
                value={filter}
                onChange={(value) => setFilter(value as Filter)}
                items={FILTERS.map((value) => ({
                  value,
                  label: t(`companyPortal.inquiries.filters.${value}`),
                  count:
                    value === 'all' ? data.length : data.filter((i) => i.status === value).length,
                }))}
              />
              <div {...tabPanelProps('inquiries', filter)}>
                {shown.length ? (
                  <ul className="flex flex-col gap-3">
                    {shown.map((inquiry) => (
                      <InquiryCard
                        key={inquiry.id}
                        inquiry={inquiry}
                        onOpen={() => open({ inquiry: inquiry.id })}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={SearchX} title={t('companyPortal.inquiries.noResults')} />
                )}
              </div>
            </div>
          );
        }}
      </QueryState>
      {opened && <InquiryModal inquiry={opened} onClose={() => close(['inquiry'])} />}
    </>
  );
}
