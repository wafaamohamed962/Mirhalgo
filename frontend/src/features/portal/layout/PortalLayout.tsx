import { useState, type FormEvent } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Menu, Search } from 'lucide-react';
import { PortalDrawer } from '../../../components/portal/PortalDrawer';
import { PortalShell } from '../../../components/portal/PortalShell';
import { SidebarLink, SidebarLogout } from '../../../components/portal/SidebarLink';
import { usePortalTitle } from '../../../components/portal/usePortalTitle';
import { useSidebarCollapsed } from '../../../components/portal/useSidebarCollapsed';
import { cn } from '../../../lib/utils';
import '../../../i18n/portal'; // portal copy, loaded with this chunk
import { useOrders } from '../../../services/api/queries';
import { useAuth } from '../../auth/hooks/useAuth';
import { MAIN_NAV, NOTIFICATIONS_NAV, SUPPORT_NAV, type PortalNavItem } from './nav';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

function NavItem({
  item,
  collapsed,
  badge,
  onNavigate,
}: {
  item: PortalNavItem;
  collapsed?: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SidebarLink
      to={item.to}
      icon={item.icon}
      label={t(`portal.nav.${item.id}`)}
      collapsed={collapsed}
      badge={badge}
      badgeLabel={t('portal.nav.newOffersBadge')}
      onNavigate={onNavigate}
    />
  );
}

/** "Search orders by reference number" (decision 20) → My Orders with the search filled in. */
function OrderSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/app/orders?search=${encodeURIComponent(value.trim())}`);
  };
  return (
    <form role="search" onSubmit={submit} className="relative hidden w-64 lg:block">
      <label htmlFor="portal-search" className="sr-only">
        {t('portal.search.label')}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
      <input
        id="portal-search"
        type="search"
        dir="ltr"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('portal.search.placeholder')}
        className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 ps-9 pe-4 text-small text-heading placeholder:text-muted focus:border-blue-600 focus:bg-white"
      />
    </form>
  );
}

/**
 * Customer portal shell (MW_002 B1): sidebar (start side → right in Arabic; collapsible,
 * collapsed by default on tablet), top bar (title · search · bell · avatar menu) and a
 * bottom navigation + drawer on mobile. The frame is shared with the company portal.
 */
export function PortalLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const title = usePortalTitle('portal.nav', 'portal.brand');
  const [collapsed, toggle] = useSidebarCollapsed();
  const [moreOpen, setMoreOpen] = useState(false);
  const badge =
    useOrders({ tab: 'all', search: '', sort: 'newest' }).data?.pages[0]?.withNewOffers ?? 0;
  const logout = () => void signOut();
  const closeMore = () => setMoreOpen(false);

  return (
    <PortalShell
      homeTo="/app"
      labels={{
        home: t('nav.home'),
        nav: t('portal.mainNav'),
        skip: t('portal.skipToContent'),
        collapse: t('portal.collapseSidebar'),
        expand: t('portal.expandSidebar'),
      }}
      collapsed={collapsed}
      onToggle={toggle}
      mainClassName="pb-28 md:pb-10"
      nav={MAIN_NAV.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          collapsed={collapsed}
          badge={item.id === 'orders' ? badge : undefined}
        />
      ))}
      sidebarFooter={
        <>
          <NavItem item={SUPPORT_NAV} collapsed={collapsed} />
          <SidebarLogout onLogout={logout} collapsed={collapsed} />
        </>
      }
      header={
        <>
          {/* py-1: `truncate` clips to the line box, which cut Arabic dots below the baseline */}
          <h1 className="min-w-0 flex-1 truncate py-1 text-h3">{title}</h1>
          <OrderSearch />
          <NotificationBell />
          <UserMenu />
        </>
      }
      mobile={
        <>
          <nav
            aria-label={t('portal.mainNav')}
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden!"
          >
            {MAIN_NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-16 flex-col items-center justify-center gap-1 text-caption font-semibold no-underline',
                    isActive ? 'text-blue-600' : 'text-muted',
                  )
                }
              >
                <item.icon aria-hidden="true" className="size-6" />
                {t(`portal.navShort.${item.id}`)}
                {item.id === 'orders' && badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute end-1/4 top-2 size-2.5 rounded-full bg-violet-600"
                  />
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-caption font-semibold text-muted"
            >
              <Menu aria-hidden="true" className="size-6" />
              {t('portal.more')}
            </button>
          </nav>
          {moreOpen && (
            <PortalDrawer label={t('portal.more')} onClose={closeMore}>
              <NavItem item={SUPPORT_NAV} onNavigate={closeMore} />
              <NavItem item={NOTIFICATIONS_NAV} onNavigate={closeMore} />
              <div className="mt-auto">
                <SidebarLogout onLogout={logout} />
              </div>
            </PortalDrawer>
          )}
        </>
      }
    />
  );
}
