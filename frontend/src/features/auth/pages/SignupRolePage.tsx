import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, UserRound, type LucideIcon } from 'lucide-react';
import { cardClasses } from '../../../components/ui';
import { usePageMeta } from '../../../lib/usePageMeta';
import { AuthCard } from '../components/AuthCard';

const ROLES: ReadonlyArray<{ key: 'customer' | 'company'; to: string; icon: LucideIcon }> = [
  { key: 'customer', to: '/signup/customer', icon: UserRound },
  { key: 'company', to: '/signup/company', icon: Building2 },
];

/** /signup (spec 4.1): choose customer or shipping company. Keeps ?service= from the landing cards. */
export default function SignupRolePage() {
  const { t } = useTranslation();
  usePageMeta('signup');
  const { search } = useLocation();

  return (
    <AuthCard
      wide
      title={t('auth.roleSelect.title')}
      subtitle={t('auth.roleSelect.subtitle')}
      footer={
        <>
          {t('auth.roleSelect.haveAccount')}{' '}
          <Link to="/login" className="font-semibold">
            {t('auth.roleSelect.login')}
          </Link>
        </>
      }
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {ROLES.map(({ key, to, icon: Icon }) => (
          <li key={key}>
            <Link
              to={{ pathname: to, search }}
              className={cardClasses({
                interactive: true,
                className:
                  'group flex h-full flex-col gap-4 border border-slate-200 p-6 no-underline hover:border-blue-600',
              })}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="text-h3 font-extrabold text-heading">
                {t(`auth.roleSelect.${key}`)}
              </span>
              <span className="text-body">{t(`auth.roleSelect.${key}Text`)}</span>
              <ArrowRight
                aria-hidden="true"
                className="mt-auto size-5 text-blue-600 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              />
            </Link>
          </li>
        ))}
      </ul>
    </AuthCard>
  );
}
