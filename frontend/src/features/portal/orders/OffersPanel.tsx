import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Clock, Columns3, LayoutList } from 'lucide-react';
import type { Offer, OrderDetails } from '@mirhalgo/shared';
import { Alert, Button, ConfirmDialog, EmptyState } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useMoney } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation } from '../../../services/api/queries';
import { usePartnerName } from '../components/companyIdentity';
import { QuestionModal, ReasonModal } from './OrderModals';

type Dialog = { kind: 'accept' | 'reject' | 'ask'; offer: Offer } | null;

/** Offers tab (spec B4): anonymous cards, accept / reject / ask, compare when 2+. */
export function OffersPanel({ order }: { order: OrderDetails }) {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const money = useMoney();
  const partnerName = usePartnerName();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [compare, setCompare] = useState(false);
  const close = () => setDialog(null);
  const sync = { setData: keys.order(order.id), invalidate: [keys.orders] };

  const accept = useApiMutation((offer: Offer) => portalApi.acceptOffer(order.id, offer.id), {
    ...sync,
    success: 'portal.offers.accepted',
    onSuccess: close,
  });
  const reject = useApiMutation(
    ({ offer, reason }: { offer: Offer; reason?: string }) =>
      portalApi.rejectOffer(order.id, offer.id, reason),
    { ...sync, success: 'portal.offers.rejected', onSuccess: close },
  );
  const ask = useApiMutation(
    ({ offer, question }: { offer: Offer; question: string }) =>
      portalApi.askQuestion(order.id, offer.id, question),
    { success: 'portal.offers.questionSent', onSuccess: close },
  );

  if (order.offers.length === 0) {
    return (
      <EmptyState icon={Clock} title={t('portal.offers.none')} text={t('portal.offers.noneText')} />
    );
  }

  const canChoose = order.status === 'offers_received';
  const selected = order.offers.find((o) => o.status === 'selected');
  const approved = order.offers.find((o) => o.status === 'approved');

  return (
    <div className="flex flex-col gap-4">
      {selected && (
        <Alert>
          {t('portal.offers.selectedBanner', { partner: partnerName(selected.partnerNumber) })}
        </Alert>
      )}
      {approved && (
        <Alert tone="success">
          {t('portal.offers.approvedBanner', { partner: partnerName(approved.partnerNumber) })}
        </Alert>
      )}

      {order.offers.length > 1 && (
        <Button
          variant="secondary"
          shape="form"
          className="self-end"
          aria-pressed={compare}
          onClick={() => setCompare((value) => !value)}
        >
          {compare ? (
            <LayoutList aria-hidden="true" className="size-4" />
          ) : (
            <Columns3 aria-hidden="true" className="size-4" />
          )}
          {t(compare ? 'portal.offers.showCards' : 'portal.offers.compare')}
        </Button>
      )}

      {compare ? (
        <div className="relative overflow-x-auto rounded-lg bg-white shadow-md">
          <table className="w-full min-w-xl text-start text-small">
            <caption className="sr-only">{t('portal.offers.compare')}</caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="p-4 text-start text-muted">
                  {t('portal.offers.partner')}
                </th>
                {order.offers.map((offer) => (
                  <th key={offer.id} scope="col" className="p-4 text-start text-heading">
                    {partnerName(offer.partnerNumber)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['total', (o: Offer) => money(o.totalCost, o.currency)],
                  [
                    'transit',
                    (o: Offer) =>
                      t('portal.offers.days', {
                        count: o.transitDays,
                        formatted: o.transitDays.toLocaleString(i18n.language),
                      }),
                  ],
                  [
                    'includes',
                    (o: Offer) =>
                      o.includes.map((key) => t(`portal.offers.includes.${key}`)).join(' · '),
                  ],
                  ['validUntil', (o: Offer) => formatDate(o.validUntil)],
                  ['status', (o: Offer) => t(`portal.offers.status.${o.status}`)],
                ] as const
              ).map(([row, value]) => (
                <tr key={row} className="border-b border-slate-200 last:border-0">
                  <th scope="row" className="p-4 text-start font-semibold text-muted">
                    {t(`portal.offers.${row}`)}
                  </th>
                  {order.offers.map((offer) => {
                    const cheapest =
                      row === 'total' &&
                      offer.totalCost === Math.min(...order.offers.map((o) => o.totalCost));
                    return (
                      <td
                        key={offer.id}
                        className={cn('p-4 text-heading', cheapest && 'font-semibold')}
                      >
                        {value(offer)}
                        {cheapest && (
                          <span className="ms-2 rounded-full bg-blue-50 px-2 text-caption font-semibold text-blue-600">
                            {t('portal.offers.lowest')}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {order.offers.map((offer) => (
            <li key={offer.id}>
              <article
                className={cn(
                  'flex h-full flex-col gap-4 rounded-lg border-2 bg-white p-5 shadow-md',
                  offer.status === 'selected' || offer.status === 'approved'
                    ? 'border-blue-600'
                    : 'border-transparent',
                  offer.status === 'rejected' && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-heading">
                      {partnerName(offer.partnerNumber)}
                    </h3>
                    <p className="text-caption text-muted">
                      {t(`portal.offers.status.${offer.status}`)}
                    </p>
                  </div>
                  <p className="text-h3 text-heading">{money(offer.totalCost, offer.currency)}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-small">
                  <div>
                    <dt className="text-muted">{t('portal.offers.transit')}</dt>
                    <dd className="font-semibold text-heading">
                      {t('portal.offers.days', {
                        count: offer.transitDays,
                        formatted: offer.transitDays.toLocaleString(i18n.language),
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t('portal.offers.validUntil')}</dt>
                    <dd className="font-semibold text-heading">{formatDate(offer.validUntil)}</dd>
                  </div>
                </dl>
                <ul className="flex flex-wrap gap-2">
                  {offer.includes.map((key) => (
                    <li
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-caption font-semibold text-blue-600"
                    >
                      <CircleCheck aria-hidden="true" className="size-3.5" />
                      {t(`portal.offers.includes.${key}`)}
                    </li>
                  ))}
                </ul>
                {offer.notes && (
                  <p dir="auto" className="text-small text-body">
                    {offer.notes}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {canChoose && offer.status === 'pending' && (
                    <>
                      <Button shape="form" onClick={() => setDialog({ kind: 'accept', offer })}>
                        {t('portal.offers.accept')}
                      </Button>
                      <Button
                        variant="secondary"
                        shape="form"
                        onClick={() => setDialog({ kind: 'reject', offer })}
                      >
                        {t('portal.offers.reject')}
                      </Button>
                    </>
                  )}
                  {offer.status !== 'rejected' && (
                    <Button
                      variant="ghost"
                      shape="form"
                      onClick={() => setDialog({ kind: 'ask', offer })}
                    >
                      {t('portal.offers.ask')}
                    </Button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'accept' && (
        <ConfirmDialog
          title={t('portal.offers.acceptTitle', {
            partner: partnerName(dialog.offer.partnerNumber),
          })}
          description={t('portal.offers.acceptText')}
          confirmLabel={t('portal.offers.accept')}
          cancelLabel={t('ui.cancel')}
          onConfirm={() => accept.mutate(dialog.offer)}
          onCancel={close}
        />
      )}
      {dialog?.kind === 'reject' && (
        <ReasonModal
          title={t('portal.offers.rejectTitle', {
            partner: partnerName(dialog.offer.partnerNumber),
          })}
          description={t('portal.offers.rejectText')}
          confirmLabel={t('portal.offers.reject')}
          busy={reject.isPending}
          onConfirm={(reason) => reject.mutate({ offer: dialog.offer, reason })}
          onClose={close}
        />
      )}
      {dialog?.kind === 'ask' && (
        <QuestionModal
          busy={ask.isPending}
          onSend={(question) => ask.mutate({ offer: dialog.offer, question })}
          onClose={close}
        />
      )}
    </div>
  );
}
