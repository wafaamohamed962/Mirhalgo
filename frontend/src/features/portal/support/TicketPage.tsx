import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Paperclip } from 'lucide-react';
import { PORTAL_LIMITS, ticketReplySchema } from '@mirhalgo/shared';
import { Button, QueryState, Skeleton, Textarea } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useZodForm } from '../../../lib/forms';
import { cn, formatFileSize } from '../../../lib/utils';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation, useTicket } from '../../../services/api/queries';
import { TicketStatusBadge } from '../components/StatusBadge';

/** /app/support/tickets/:id (spec B8): conversation + reply. */
export default function TicketPage() {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const { id = '' } = useParams();
  const ticket = useTicket(id);
  const form = useZodForm(ticketReplySchema, { defaultValues: { message: '' } });
  const reply = useApiMutation((message: string) => portalApi.replyToTicket(id, message), {
    setData: keys.ticket(id),
    invalidate: [keys.tickets],
    success: 'portal.support.replySent',
    onSuccess: () => form.reset({ message: '' }),
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/app/support"
        className="inline-flex items-center gap-1 self-start text-small font-semibold"
      >
        <ArrowRight aria-hidden="true" className="size-4 ltr:rotate-180" />
        {t('portal.support.back')}
      </Link>
      <QueryState query={ticket} skeleton={<Skeleton className="h-96 rounded-lg" />}>
        {(data) => (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 dir="auto" className="text-h2">
                {data.subject}
              </h2>
              <TicketStatusBadge status={data.status} />
            </div>
            <p className="text-small text-muted">
              <span dir="ltr">{data.reference}</span> ·{' '}
              {t(`portal.support.categories.${data.category}`)}
              {data.orderReference && (
                <>
                  {' · '}
                  <span dir="ltr">{data.orderReference}</span>
                </>
              )}
            </p>
            <ol aria-label={t('portal.support.conversation')} className="flex flex-col gap-3">
              {data.messages.map((message) => {
                const mine = message.from === 'customer';
                return (
                  <li
                    key={message.id}
                    className={cn(
                      'max-w-[85%] rounded-lg p-4 shadow-sm',
                      mine ? 'self-end bg-blue-50' : 'self-start bg-white',
                    )}
                  >
                    <p className="mb-1 text-caption font-semibold text-muted">
                      {t(mine ? 'portal.support.you' : 'portal.support.team')} ·{' '}
                      {formatDate(message.at, true)}
                    </p>
                    <p dir="auto" className="whitespace-pre-wrap text-body">
                      {message.body}
                    </p>
                    {message.attachment && (
                      <p className="mt-2 inline-flex items-center gap-1 text-caption text-heading">
                        <Paperclip aria-hidden="true" className="size-3.5" />
                        {message.attachment.name} (
                        {formatFileSize(message.attachment.size, i18n.language)})
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <form
              noValidate
              onSubmit={form.handleSubmit((values) => reply.mutate(values.message))}
              className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-md"
            >
              <Textarea
                label={t('portal.support.reply')}
                rows={3}
                required
                maxLength={PORTAL_LIMITS.ticketMessage.max}
                error={form.formState.errors.message?.message}
                {...form.register('message')}
              />
              <Button type="submit" shape="form" className="self-end" loading={reply.isPending}>
                {t('portal.support.send')}
              </Button>
            </form>
          </>
        )}
      </QueryState>
    </div>
  );
}
