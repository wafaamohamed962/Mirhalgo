import { useTranslation } from 'react-i18next';
import { PORTAL_LIMITS, questionSchema, reasonSchema } from '@mirhalgo/shared';
import { Button, Modal, Textarea } from '../../../components/ui';
import { useZodForm } from '../../../lib/forms';

/** Optional reason (cancel a request, reject an offer). */
export function ReasonModal({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const form = useZodForm(reasonSchema, { defaultValues: { reason: '' } });
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onClose} data-autofocus>
            {t('ui.cancel')}
          </Button>
          <Button
            variant="danger"
            shape="form"
            loading={busy}
            onClick={form.handleSubmit((values) => onConfirm(values.reason))}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        label={t('portal.orders.reason')}
        rows={3}
        maxLength={PORTAL_LIMITS.reason.max}
        error={form.formState.errors.reason?.message}
        {...form.register('reason')}
      />
    </Modal>
  );
}

/** "Ask a question" about an offer (the answer arrives as a notification). */
export function QuestionModal({
  busy,
  onSend,
  onClose,
}: {
  busy: boolean;
  onSend: (question: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const form = useZodForm(questionSchema, { defaultValues: { question: '' } });
  return (
    <Modal
      title={t('portal.offers.askTitle')}
      description={t('portal.offers.askText')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button
            shape="form"
            loading={busy}
            onClick={form.handleSubmit((values) => onSend(values.question))}
          >
            {t('portal.offers.send')}
          </Button>
        </>
      }
    >
      <Textarea
        label={t('portal.offers.question')}
        rows={4}
        required
        maxLength={PORTAL_LIMITS.question.max}
        error={form.formState.errors.question?.message}
        data-autofocus
        {...form.register('question')}
      />
    </Modal>
  );
}
