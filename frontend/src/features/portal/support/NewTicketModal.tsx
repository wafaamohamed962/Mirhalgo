import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  PORTAL_LIMITS,
  TICKET_CATEGORIES,
  checkFile,
  detectMime,
  ticketSchema,
  type TicketInput,
} from '@mirhalgo/shared';
import { Button, FileUpload, Input, Modal, Select, Textarea } from '../../../components/ui';
import { useZodForm } from '../../../lib/forms';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation, useOrders } from '../../../services/api/queries';

/** Attachment ≤ 5 MB, PDF / JPG / PNG: the same rules as a legal document (spec B8). */
const ATTACHMENT_RULES = 'tax_card' as const;

/** "New ticket" (spec B8): subject, category, related order (optional), message, attachment. */
export function NewTicketModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const orders = useOrders({ tab: 'all', search: '', sort: 'newest' });
  const form = useZodForm(ticketSchema, {
    defaultValues: { subject: '', orderReference: '', message: '' },
  });
  const { errors } = form.formState;
  const create = useApiMutation(
    (input: TicketInput) =>
      portalApi.createTicket({
        ...input,
        attachment: file ? { name: file.name, size: file.size } : null,
      }),
    {
      invalidate: [keys.tickets],
      success: 'portal.support.ticketCreated',
      onSuccess: (ticket) => {
        onClose();
        navigate(`/app/support/tickets/${ticket.id}`);
      },
    },
  );

  const pick = async (picked: File) => {
    const head = new Uint8Array(await picked.slice(0, 16).arrayBuffer());
    const problem = checkFile({ size: picked.size, mime: detectMime(head) }, ATTACHMENT_RULES);
    setFileError(problem ?? undefined);
    setFile(problem ? null : picked);
  };

  const orderOptions = (orders.data?.pages.flatMap((page) => page.items) ?? []).map((order) => ({
    value: order.reference,
    label: order.reference,
  }));

  return (
    <Modal
      size="lg"
      title={t('portal.support.newTicket')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button
            shape="form"
            loading={create.isPending}
            onClick={form.handleSubmit((values) => create.mutate(values))}
          >
            {t('portal.support.send')}
          </Button>
        </>
      }
    >
      <form noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label={t('portal.support.subject')}
            required
            data-autofocus
            maxLength={PORTAL_LIMITS.ticketSubject.max}
            error={errors.subject?.message}
            {...form.register('subject')}
          />
        </div>
        <Select
          label={t('portal.support.category')}
          placeholder={t('portal.support.categoryPlaceholder')}
          required
          options={TICKET_CATEGORIES.map((value) => ({
            value,
            label: t(`portal.support.categories.${value}`),
          }))}
          error={errors.category?.message}
          {...form.register('category')}
        />
        <Select
          label={t('portal.support.relatedOrder')}
          placeholder={t('portal.support.noOrder')}
          options={orderOptions}
          {...form.register('orderReference')}
        />
        <div className="sm:col-span-2">
          <Textarea
            label={t('portal.support.message')}
            rows={5}
            required
            maxLength={PORTAL_LIMITS.ticketMessage.max}
            error={errors.message?.message}
            {...form.register('message')}
          />
        </div>
        <div className="sm:col-span-2">
          <FileUpload
            label={t('portal.support.attachment')}
            hint={t('company.register.files.documentHint')}
            accept="application/pdf,image/jpeg,image/png"
            value={file}
            onSelect={(picked) => void pick(picked)}
            onRemove={() => setFile(null)}
            error={fileError}
          />
        </div>
      </form>
    </Modal>
  );
}
