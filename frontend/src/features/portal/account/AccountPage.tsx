import type { ComponentType } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ChevronLeft,
  Gauge,
  Languages,
  MapPin,
  ShieldCheck,
  User,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { BackButton } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { AddressesSection } from './AddressesSection';
import {
  BalanceSection,
  NotificationsSection,
  PreferencesSection,
  PrivacySection,
} from './OtherSections';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';

const SECTIONS: ReadonlyArray<{ id: string; icon: LucideIcon; Component: ComponentType }> = [
  { id: 'profile', icon: User, Component: ProfileSection },
  { id: 'security', icon: ShieldCheck, Component: SecuritySection },
  { id: 'notifications', icon: Bell, Component: NotificationsSection },
  { id: 'addresses', icon: MapPin, Component: AddressesSection },
  { id: 'balance', icon: Gauge, Component: BalanceSection },
  { id: 'preferences', icon: Languages, Component: PreferencesSection },
  { id: 'privacy', icon: UserX, Component: PrivacySection },
];

/**
 * /app/account/:section (spec B6): tabs on desktop, a list on mobile (/app/account shows the
 * list on mobile and Profile on desktop).
 */
export default function AccountPage() {
  const { t } = useTranslation();
  const { section } = useParams();
  const current = SECTIONS.find((s) => s.id === (section ?? 'profile'));
  if (!current) return <Navigate to="/app/account" replace />;
  const label = (id: string) => t(`portal.account.sections.${id}`);

  return (
    <div className="flex flex-col gap-5">
      <nav
        aria-label={t('portal.account.nav')}
        className="hidden overflow-x-auto border-b border-slate-200 md:block"
      >
        <ul className="flex gap-1">
          {SECTIONS.map(({ id, icon: Icon }) => (
            <li key={id}>
              <Link
                to={`/app/account/${id}`}
                aria-current={current.id === id ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-small font-semibold whitespace-nowrap no-underline',
                  current.id === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted hover:text-heading',
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label(id)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!section && (
        <nav aria-label={t('portal.account.nav')} className="md:hidden">
          <ul className="divide-y divide-slate-200 rounded-lg bg-white shadow-md">
            {SECTIONS.map(({ id, icon: Icon }) => (
              <li key={id}>
                <Link
                  to={`/app/account/${id}`}
                  className="flex min-h-14 items-center gap-3 px-4 font-semibold text-heading no-underline"
                >
                  <Icon aria-hidden="true" className="size-5 text-blue-600" />
                  <span className="flex-1">{label(id)}</span>
                  <ChevronLeft aria-hidden="true" className="size-5 text-muted ltr:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section
        aria-labelledby="account-section-title"
        className={cn('rounded-lg bg-white p-5 shadow-md sm:p-8', !section && 'hidden md:block')}
      >
        {section && <BackButton className="mb-4 md:hidden" />}
        <h2 id="account-section-title" className="mb-6 text-h2">
          {label(current.id)}
        </h2>
        <current.Component />
      </section>
    </div>
  );
}
