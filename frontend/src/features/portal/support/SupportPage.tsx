import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FaWhatsapp } from 'react-icons/fa';
import { LifeBuoy, Mail, MessageSquarePlus, Search } from 'lucide-react';
import { Accordion, Button, EmptyState, QueryState } from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { SOCIAL_LINKS } from '../../../lib/navigation';
import { useTickets } from '../../../services/api/queries';
import { TicketStatusBadge } from '../components/StatusBadge';
import { NewTicketModal } from './NewTicketModal';

const FAQ_TOPICS = ['requests', 'attempts', 'offers', 'payments', 'cancellation'] as const;
const FAQ_PER_TOPIC = 2;
const SUPPORT_EMAIL = 'mirhalgov1@gmail.com';

function Faq() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const items = useMemo(
    () =>
      FAQ_TOPICS.flatMap((topic) =>
        Array.from({ length: FAQ_PER_TOPIC }, (_, i) => ({
          id: `${topic}-${i}`,
          topic,
          question: t(`portal.faq.${topic}.${i}.q`),
          answer: t(`portal.faq.${topic}.${i}.a`),
        })),
      ),
    [t],
  );
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(needle))
    : items;

  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-4">
      <h2 id="faq-title" className="text-h3">
        {t('portal.support.faq')}
      </h2>
      <div className="relative">
        <label htmlFor="faq-search" className="sr-only">
          {t('portal.support.faqSearch')}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('portal.support.faqSearch')}
          className="h-(--btn-height) w-full rounded-sm border border-slate-200 bg-white ps-10 pe-4 text-heading shadow-sm placeholder:text-muted focus:border-blue-600 focus:bg-blue-50"
        />
      </div>
      {shown.length ? (
        <Accordion
          items={shown.map(({ id, question, answer }) => ({
            id,
            title: question,
            content: answer,
          }))}
        />
      ) : (
        <p aria-live="polite" className="text-small text-muted">
          {t('portal.support.faqEmpty')}
        </p>
      )}
    </section>
  );
}

function Tickets() {
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const tickets = useTickets();
  const [creating, setCreating] = useState(false);

  return (
    <section aria-labelledby="tickets-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tickets-title" className="text-h3">
          {t('portal.support.myTickets')}
        </h2>
        <Button shape="form" onClick={() => setCreating(true)}>
          <MessageSquarePlus aria-hidden="true" className="size-4" />
          {t('portal.support.newTicket')}
        </Button>
      </div>
      <QueryState
        query={tickets}
        isEmpty={(list) => list.length === 0}
        empty={<EmptyState icon={LifeBuoy} title={t('portal.support.noTickets')} />}
      >
        {(list) => (
          <ul className="flex flex-col gap-3">
            {list.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/app/support/tickets/${ticket.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 no-underline shadow-md hover:shadow-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate font-semibold text-heading">
                      {ticket.subject}
                    </p>
                    <p className="text-caption text-muted">
                      <span dir="ltr">{ticket.reference}</span> ·{' '}
                      {t(`portal.support.categories.${ticket.category}`)} ·{' '}
                      {formatDate(ticket.updatedAt, true)}
                    </p>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {creating && <NewTicketModal onClose={() => setCreating(false)} />}
    </section>
  );
}

/** /app/support (spec B8): FAQ, contact channels, support tickets. */
export default function SupportPage() {
  const { t } = useTranslation();
  const whatsapp = SOCIAL_LINKS.find((link) => link.id === 'whatsapp')?.href;

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-8">
        <Faq />
        <Tickets />
      </div>
      <aside className="flex flex-col gap-3 self-start rounded-lg bg-white p-5 shadow-md">
        <h2 className="text-h3">{t('portal.support.contact')}</h2>
        <p className="text-small text-body">{t('portal.support.contactText')}</p>
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-sm border border-slate-200 px-4 font-semibold text-heading no-underline hover:bg-slate-50"
          >
            <FaWhatsapp aria-hidden="true" className="size-5 text-whatsapp" />
            {t('contact.whatsapp')}
            <span className="sr-only">{t('ui.opensInNewTab')}</span>
          </a>
        )}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex min-h-11 items-center gap-3 rounded-sm border border-slate-200 px-4 font-semibold text-heading no-underline hover:bg-slate-50"
        >
          <Mail aria-hidden="true" className="size-5 text-blue-600" />
          <span dir="ltr">{SUPPORT_EMAIL}</span>
        </a>
      </aside>
    </div>
  );
}
