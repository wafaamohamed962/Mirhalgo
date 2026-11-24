import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Menu } from 'lucide-react';
import { LanguageSwitch } from '../../../components/layout/LanguageSwitch';
import { PortalDrawer } from '../../../components/portal/PortalDrawer';
import { PortalShell } from '../../../components/portal/PortalShell';
import { SidebarLink, SidebarLogout } from '../../../components/portal/SidebarLink';
import { usePortalTitle } from '../../../components/portal/usePortalTitle';
import { useSidebarCollapsed } from '../../../components/portal/useSidebarCollapsed';
import { Avatar } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import '../../../i18n/company'; // company portal copy, loaded with this chunk
import { useCompanyAccount, useCompanyDashboard } from '../../../services/api/companyQueries';
import { useAuth } from '../../auth/hooks/useAuth';
import { COMPANY_NAV } from './nav';

/** Avatar, display name (alias, else the legal name) and the login email (spec B2). */
function CompanyBlock({ collapsed }: { collapsed?: boolean }) {
  const account = useCompanyAccount().data;
  if (!account) return null;
  const name = account.alias ?? account.legalName;
  return (
    <div
      className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center px-0')}
      title={collapsed ? name : undefined}
    >
      {/* one initial: the first letter of the legal name */}
      <Avatar name={account.legalName.split(/\s+/)[0] ?? ''} className="bg-blue-600 text-white" />
      <div className={cn('min-w-0', collapsed && 'sr-only')}>
        <p className="truncate text-small font-semibold text-white">{name}</p>
        <p dir="ltr" className="truncate text-caption text-on-dark-muted rtl:text-end">
          {account.email}
        </p>
      </div>
    </div>
  );
}

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const counts = useCompanyDashboard().data?.counts;
  return COMPANY_NAV.map((item) => (
    <SidebarLink
      key={item.id}
      to={item.to}
      icon={item.icon}
      label={t(`companyPortal.nav.${item.id}`)}
      collapsed={collapsed}
      badge={item.badge ? counts?.[item.badge] : undefined}
      badgeLabel={item.badge ? t(`companyPortal.badges.${item.id}`) : undefined}
      onNavigate={onNavigate}
    />
  ));
}

/**
 * Company portal shell (MW_004 spec B2): the customer portal's frame, branded for partner
 * companies. Sidebar with the 6 sections (3 with count badges) and the company block +
 * Logout; top bar with the welcome, the account status and the language switch; a drawer on
 * mobile instead of the customer bottom nav (6 items).
 */
export function CompanyLayout() {
  const { t } = useTranslation();
  const { signOut, companyStatus } = useAuth();
  usePortalTitle('companyPortal.nav', 'companyPortal.brand');
  const [collapsed, toggle] = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);
  const account = useCompanyAccount().data;
  const logout = () => void signOut();
  const closeMenu = () => setMenuOpen(false);

  return (
    <PortalShell
      homeTo="/company/overview"
      labels={{
        home: t('companyPortal.nav.overview'),
        nav: t('companyPortal.mainNav'),
        skip: t('companyPortal.skipToContent'),
        collapse: t('companyPortal.collapseSidebar'),
        expand: t('companyPortal.expandSidebar'),
      }}
      collapsed={collapsed}
      onToggle={toggle}
      mainClassName="pb-10"
      brand={
        <p className="-mt-3 mb-2 px-2 text-caption text-on-dark-muted">
          {t('companyPortal.brandLine')}
        </p>
      }
      nav={<NavLinks collapsed={collapsed} />}
      sidebarFooter={
        <>
          <CompanyBlock collapsed={collapsed} />
          <SidebarLogout onLogout={logout} collapsed={collapsed} />
        </>
      }
      header={
        <>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-label={t('companyPortal.openMenu')}
            className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-heading hover:bg-slate-50 md:hidden"
          >
            <Menu aria-hidden="true" className="size-6" />
          </button>
          <p className="min-w-0 flex-1 truncate text-base font-semibold text-heading sm:text-h3">
            {account && t('companyPortal.welcome', { name: account.alias ?? account.legalName })}
          </p>
          {companyStatus === 'approved' && (
            // blue-700 text (6.1:1 on blue-50); the green check is the status colour
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-caption font-semibold text-blue-700 sm:inline-flex">
              <CircleCheck aria-hidden="true" className="size-4 text-success" />
              {t('companyPortal.accountStatus.approved')}
            </span>
          )}
          <LanguageSwitch />
        </>
      }
      mobile={
        menuOpen && (
          <PortalDrawer label={t('companyPortal.menu')} onClose={closeMenu}>
            {companyStatus === 'approved' && (
              <span className="mb-2 self-start rounded-full bg-white/10 px-3 py-1 text-caption font-semibold text-white">
                {t('companyPortal.accountStatus.approved')}
              </span>
            )}
            <nav aria-label={t('companyPortal.mainNav')} className="flex flex-col gap-1">
              <NavLinks onNavigate={closeMenu} />
            </nav>
            <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
              <CompanyBlock />
              <SidebarLogout onLogout={logout} />
            </div>
          </PortalDrawer>
        )
      }
    />
  );
}
