import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, Printer } from 'lucide-react';
import { ORDER_STATUSES, type OrderRecord, type OrderStatus } from '@mirhalgo/shared';
import { Logo } from '../../components/layout/Logo';
import {
  Alert,
  Button,
  ErrorState,
  Skeleton,
  buttonClasses,
  cardClasses,
} from '../../components/ui';
import { ApiRequestError } from '../../lib/apiClient';
import { useDateFormat } from '../../lib/dateFormat';
import { downloadElementAsPdf } from '../../lib/downloadPdf';
import { useMeSummary, useOrderRecord } from '../../services/api/queries';
import { OrderStatusBadge } from '../portal/components/StatusBadge';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-3 last:border-0">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="font-semibold text-heading">{children}</dd>
    </div>
  );
}

/** The confirmation card: what is printed and saved as PDF. */
function ConfirmationCard({ record }: { record: OrderRecord }) {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const balance = useMeSummary().data?.balance;
  const status = (ORDER_STATUSES as readonly string[]).includes(record.status)
    ? (record.status as OrderStatus)
    : null;
  const number = (n: number) => n.toLocaleString(i18n.language);

  return (
    <>
      <div className="flex justify-center">
        <Logo />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 aria-hidden="true" className="size-14 text-success" />
        <h2 className="text-h2">{t('portal.request.success.title')}</h2>
        <p className="text-body">
          {t(
            record.service === 'china'
              ? 'portal.request.success.messageChina'
              : 'portal.request.success.message',
          )}
        </p>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-50 p-4">
        <span className="text-small text-muted">{t('portal.request.success.reference')}</span>
        <span dir="ltr" className="text-display leading-none font-extrabold text-blue-600">
          {record.reference}
        </span>
      </div>
      <dl>
        <Row label={t('portal.request.success.service')}>
          {t(`portal.services.${record.service}.title`)}
        </Row>
        <Row label={t('portal.request.success.date')}>{formatDate(record.submittedAt, true)}</Row>
        {status && (
          <Row label={t('portal.request.success.status')}>
            <OrderStatusBadge status={status} />
          </Row>
        )}
        {balance && (
          <Row label={t('portal.request.success.balance')}>
            {t('portal.request.success.balanceValue', {
              remaining: number(balance.remaining),
              total: number(balance.total),
            })}
          </Row>
        )}
      </dl>
    </>
  );
}

/**
 * /app/new-request/success/:reference (MW_003 B6). Reads the order from the API, so a reload or
 * a shared link shows the same card. Print prints the card only (the portal shell is
 * `print:hidden`); Download PDF captures it (lib/downloadPdf, lazy).
 */
export default function RequestSuccessPage() {
  const { t } = useTranslation();
  const { reference = '' } = useParams();
  const query = useOrderRecord(reference);
  const card = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<'idle' | 'working' | 'failed'>('idle');

  const download = async () => {
    if (!card.current || pdf === 'working') return;
    setPdf('working');
    try {
      await downloadElementAsPdf(card.current, `MirhalGo-${reference}.pdf`);
      setPdf('idle');
    } catch {
      setPdf('failed');
    }
  };

  if (query.isPending) return <Skeleton className="mx-auto h-[32rem] max-w-xl rounded-lg" />;
  if (query.isError) {
    const notFound = query.error instanceof ApiRequestError && query.error.status === 404;
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        {notFound ? (
          <Alert tone="error">{t('portal.request.success.notFound')}</Alert>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
        <Link to="/app/orders" className={buttonClasses({ variant: 'secondary', shape: 'form' })}>
          {t('portal.request.success.viewOrders')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div
        ref={card}
        className={cardClasses({
          className:
            'flex flex-col gap-6 p-6 [print-color-adjust:exact] sm:p-8 print:border-0 print:shadow-none',
        })}
      >
        <ConfirmationCard record={query.data} />
      </div>
      {pdf === 'failed' && (
        <div className="print:hidden">
          <Alert tone="error">{t('portal.request.success.pdfError')}</Alert>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
        <Button variant="secondary" shape="form" onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-4" />
          {t('portal.request.success.print')}
        </Button>
        <Button
          variant="secondary"
          shape="form"
          onClick={() => void download()}
          loading={pdf === 'working'}
        >
          <Download aria-hidden="true" className="size-4" />
          {t('portal.request.success.downloadPdf')}
        </Button>
        <Link
          to="/app/orders"
          className={buttonClasses({ shape: 'form', className: 'sm:ms-auto' })}
        >
          {t('portal.request.success.viewOrders')}
        </Link>
      </div>
    </div>
  );
}
