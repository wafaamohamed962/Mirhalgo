import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { CompanyRequestDetails } from '@mirhalgo/shared';
import { Alert, Button, Modal, QueryState } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useCompanyRequest } from '../../../services/api/companyQueries';
import type { SummaryRow } from '../../requests/summary';
import { CategoryChip } from '../categories';
import { useSeen } from '../seen';
import { useOrderSections } from '../useOrderSections';
import { CompanyOrderStatusBadge } from './StatusBadges';

function Rows({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) return <p className="text-small text-heading">—</p>;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className="flex min-w-0 flex-col">
          <dt className="text-caption text-muted">{row.label}</dt>
          {/* client content as plain text (spec B10: never raw HTML) */}
          <dd dir="auto" className="text-small break-words whitespace-pre-line text-heading">
            {row.value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Details({ details }: { details: CompanyRequestDetails }) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const sections = useOrderSections(details);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-small text-muted">
        <CategoryChip category={details.category} />
        <CompanyOrderStatusBadge status={details.status} />
        <span>{formatDate(details.createdAt)}</span>
      </div>
      <Alert tone="info">{t('companyPortal.details.privacy')}</Alert>
      {sections.map((section) => (
        <section key={section.step} className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-base font-semibold text-heading">{section.title}</h3>
          <Rows rows={section.rows} />
        </section>
      ))}
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-base font-semibold text-heading">
          {t('companyPortal.details.attachments')}
        </h3>
        {details.attachments.length ? (
          <ul className="flex flex-col gap-1 text-small text-heading">
            {details.attachments.map((file) => (
              <li key={file.name} dir="ltr" className="rtl:text-end">
                {file.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-heading">—</p>
        )}
      </section>
    </div>
  );
}

/**
 * Order details (spec B4): the privacy notice, every visible section and field ("—" when
 * empty), and Submit offer. Opening it marks the request as seen ("New" disappears).
 */
export function OrderDetailsModal({
  orderId,
  onClose,
  onSubmitOffer,
}: {
  orderId: string;
  onClose: () => void;
  /** Absent when an offer cannot be submitted (closed order, suspended account). */
  onSubmitOffer?: () => void;
}) {
  const { t } = useTranslation();
  const details = useCompanyRequest(orderId);
  const { markSeen } = useSeen();
  useEffect(() => markSeen('request', orderId), [markSeen, orderId]);
  const canSubmit = details.data?.status === 'open' && onSubmitOffer;

  return (
    <Modal
      title={t('companyPortal.details.title', { id: orderId })}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onClose}>
            {t('ui.close')}
          </Button>
          {canSubmit && (
            <Button shape="form" onClick={onSubmitOffer}>
              {details.data!.ourOffersCount > 0
                ? t('companyPortal.requests.submitAdditional')
                : t('companyPortal.submitOffer')}
            </Button>
          )}
        </>
      }
    >
      <QueryState query={details}>{(data) => <Details details={data} />}</QueryState>
    </Modal>
  );
}
