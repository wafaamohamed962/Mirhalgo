import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  COMPANY_PORTAL_LIMITS,
  inquiryReplySchema,
  type CompanyInquiry,
  type InquiryReplyInput,
} from '@mirhalgo/shared';
import { Button, ConfirmDialog, Modal, QueryState, Textarea } from '../../../components/ui';
import { errorKey } from '../../../lib/apiClient';
import { useDateFormat } from '../../../lib/dateFormat';
import { hasChanges, useZodForm } from '../../../lib/forms';
import { useUnsavedChangesGuard } from '../../../lib/useUnsavedChangesGuard';
import { companyApi } from '../../../services/api/company';
import { companyKeys, useCompanyRequest } from '../../../services/api/companyQueries';
import { CategoryChip } from '../categories';
import { useOfferTotal } from '../companyFormat';
import { InquiryStatusBadge, OfferStatusBadge } from '../components/StatusBadges';
import { useSeen } from '../seen';
import { useOrderSections } from '../useOrderSections';

/** Order summary: id, service, the first 3 visible fields, a link to the full details. */
function OrderSummary({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const request = useCompanyRequest(orderId);
  const sections = useOrderSections(request.data);
  // the customer section only holds the client type: start with the shipment itself
  const rows = sections
    .filter((section) => section.step !== 'customer')
    .flatMap((section) => section.rows)
    .slice(0, 3);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 dir="ltr" className="text-base font-semibold text-heading">
          {orderId}
        </h3>
        {request.data && <CategoryChip category={request.data.category} />}
      </div>
      <QueryState query={request}>
        {() => (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
            {rows.map((row, i) => (
              <div key={`${row.label}-${i}`} className="flex min-w-0 flex-col">
                <dt className="text-caption text-muted">{row.label}</dt>
                <dd dir="auto" className="text-small break-words text-heading">
                  {row.value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </QueryState>
      <Link
        to={`/company/requests?order=${orderId}`}
        className="self-start text-small font-semibold"
      >
        {t('companyPortal.inquiries.fullDetails')}
      </Link>
    </section>
  );
}

/**
 * One inquiry (MW_004 spec B8): the order summary (no contact data), our offers on it, the
 * client's question and our reply. A reply is sent once and then shown read-only with its date
 * (the demo let it be overwritten). It reaches the client through the platform administration.
 */
export function InquiryModal({
  inquiry,
  onClose,
}: {
  inquiry: CompanyInquiry;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const total = useOfferTotal();
  const queryClient = useQueryClient();
  const { markSeen } = useSeen();
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => markSeen('inquiry', inquiry.id), [markSeen, inquiry.id]);

  const form = useZodForm(inquiryReplySchema, { defaultValues: { reply: '' } });
  const dirty = hasChanges(form.formState.dirtyFields);
  const guard = useUnsavedChangesGuard(dirty && !inquiry.reply, {
    title: t('companyPortal.inquiries.leaveTitle'),
    description: t('companyPortal.inquiries.leaveText'),
  });
  const send = useMutation({
    mutationFn: (input: InquiryReplyInput) => companyApi.replyToInquiry(inquiry.id, input),
    onSuccess: async () => {
      toast.success(t('companyPortal.inquiries.sent'));
      form.reset({ reply: '' });
      await queryClient.invalidateQueries({ queryKey: companyKeys.all });
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });
  const close = () => (dirty && !inquiry.reply ? setConfirmClose(true) : onClose());
  const replyError = form.formState.errors.reply?.message;

  return (
    <>
      <Modal
        title={t('companyPortal.inquiries.title', { id: inquiry.id })}
        onClose={close}
        size="lg"
        footer={
          <>
            <Button variant="secondary" shape="form" onClick={close}>
              {t('ui.close')}
            </Button>
            {!inquiry.reply && (
              <Button type="submit" form="reply-form" shape="form" loading={send.isPending}>
                {t('companyPortal.inquiries.send')}
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-small text-muted">
            <InquiryStatusBadge status={inquiry.status} />
            <span>{formatDate(inquiry.createdAt, true)}</span>
          </div>
          <p className="text-small text-muted">{t('companyPortal.inquiries.note')}</p>
          <OrderSummary orderId={inquiry.orderId} />

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-heading">
              {t('companyPortal.inquiries.ourOffers')}
            </h3>
            {inquiry.ours.length ? (
              <ul className="flex flex-col gap-2">
                {inquiry.ours.map((offer) => (
                  <li
                    key={offer.id}
                    className="flex flex-wrap items-center gap-3 rounded-sm border border-slate-200 p-3 text-small"
                  >
                    <span dir="ltr" className="font-semibold whitespace-nowrap text-heading">
                      {offer.id}
                    </span>
                    <OfferStatusBadge status={offer.status} />
                    <span dir="auto" className="ms-auto font-semibold text-heading">
                      {total(offer.total)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-muted">—</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-heading">
              {t('companyPortal.inquiries.question')}
            </h3>
            {/* client content as plain text (spec B10: never raw HTML) */}
            <p dir="auto" className="rounded-sm bg-slate-50 p-3 whitespace-pre-line text-body">
              {inquiry.question}
            </p>
          </section>

          {inquiry.reply ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-heading">
                {t('companyPortal.inquiries.ourReply')}
              </h3>
              <p
                dir="auto"
                className="rounded-sm border border-slate-200 p-3 whitespace-pre-line text-body"
              >
                {inquiry.reply.text}
              </p>
              <p className="text-caption text-muted">
                {t('companyPortal.inquiries.sentAt', {
                  date: formatDate(inquiry.reply.sentAt, true),
                })}
              </p>
            </section>
          ) : (
            <form
              id="reply-form"
              noValidate
              onSubmit={form.handleSubmit((values) => send.mutate(values))}
              className="flex flex-col gap-2"
            >
              <Textarea
                label={t('companyPortal.inquiries.reply')}
                hint={t('companyPortal.inquiries.replyHint')}
                required
                rows={5}
                maxLength={COMPANY_PORTAL_LIMITS.reply.max}
                {...form.register('reply')}
                error={replyError ? t(replyError) : undefined}
              />
            </form>
          )}
        </div>
      </Modal>
      {confirmClose && (
        <ConfirmDialog
          title={t('companyPortal.inquiries.leaveTitle')}
          description={t('companyPortal.inquiries.leaveText')}
          confirmLabel={t('ui.leave.leave')}
          cancelLabel={t('ui.leave.stay')}
          tone="danger"
          onConfirm={() => {
            setConfirmClose(false);
            guard.allowLeave();
            onClose();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {guard.dialog}
    </>
  );
}
