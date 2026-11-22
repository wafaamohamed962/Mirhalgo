import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LogOut, UserCog } from 'lucide-react';
import { LanguageSwitch } from '../../../components/layout/LanguageSwitch';
import { Avatar, Popover } from '../../../components/ui';
import { useMe } from '../../../services/api/queries';
import { useAuth } from '../../auth/hooks/useAuth';

const ITEM =
  'flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-small font-semibold text-heading no-underline hover:bg-slate-50';

/** Avatar menu: name, Account, Language AR/EN, Logout (spec B1). */
export function UserMenu() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const me = useMe();
  const name = me.data ? `${me.data.firstName} ${me.data.lastName}` : '';

  return (
    <Popover
      label={t('portal.userMenu', { name })}
      className="w-64"
      trigger={
        <>
          <Avatar name={name || '?'} src={me.data?.avatarUrl} />
          <ChevronDown aria-hidden="true" className="hidden size-4 text-muted sm:block" />
        </>
      }
    >
      {(close) => (
        <div className="flex flex-col gap-1">
          <div className="border-b border-slate-200 px-3 pt-1 pb-3">
            <p className="truncate font-semibold text-heading">{name}</p>
            <p dir="ltr" className="truncate text-caption text-muted">
              {me.data?.email}
            </p>
          </div>
          <Link to="/app/account/profile" onClick={close} className={ITEM}>
            <UserCog aria-hidden="true" className="size-5 text-muted" />
            {t('portal.nav.account')}
          </Link>
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-small font-semibold text-heading">{t('portal.language')}</span>
            <LanguageSwitch />
          </div>
          <button type="button" onClick={() => void signOut()} className={ITEM}>
            <LogOut aria-hidden="true" className="size-5 text-error rtl:rotate-180" />
            {t('nav.logout')}
          </button>
        </div>
      )}
    </Popover>
  );
}
