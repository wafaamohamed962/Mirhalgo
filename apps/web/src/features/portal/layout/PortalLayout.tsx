import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useMatches, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { Logo } from '../../../components/layout/Logo';
import { LanguageSwitch } from '../../../components/layout/LanguageSwitch';
import { useModalBehavior } from '../../../lib/useModalBehavior';
import { cn } from '../../../lib/utils';
import '../../../i18n/portal'; // portal copy, loaded with this chunk
import { useOrders } from '../../../services/api/queries';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  MAIN_NAV,
  NOTIFICATIONS_NAV,
  SUPPORT_NAV,
  type PortalHandle,
  type PortalNavItem,
} from './nav';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

const COLLAPSED_KEY = 'mirhalgo.sidebarCollapsed';

/** Desktop: expanded unless the user collapsed it. Tablet: collapsed by default (spec B1). */
function initialCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // ignore
  }
  return window.matchMedia?.('(max-width: 1279px)').matches ?? false;
}

/** Top-bar title from the deepest route `handle`, also used as the document title. */
function usePageTitle() {
  const { t } = useTranslation();
  const handle = [...useMatches()].reverse().find((m) => (m.handle as PortalHandle)?.title)
    ?.handle as PortalHandle | undefined;
  const title = handle
    ? t(handle.title.includes('.') ? handle.title : `portal.nav.${handle.title}`)
    : '';
  useEffect(() => {
    document.title = `${title} | ${t('portal.brand')}`;
  }, [title, t]);
  return title;
}

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
  const { t, i18n } = useTranslation();
  const label = t(`portal.nav.${item.id}`);
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-3 rounded-sm px-3 text-small font-semibold no-underline transition-colors duration-150 ease-out',
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-on-dark-muted hover:bg-white/10 hover:text-white',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <item.icon aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn(collapsed && 'sr-only')}>{label}</span>
      {badge ? (
        <span
          className={cn(
            'rounded-full bg-violet-600 px-2 text-caption text-white',
            collapsed ? 'absolute end-1 top-1 px-1.5' : 'ms-auto',
          )}
        >
          {badge.toLocaleString(i18n.language)}
          <span className="sr-only"> {t('portal.nav.newOffersBadge')}</span>
        </span>
      ) : null}
    </NavLink>
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

/** Mobile drawer for the items that are not in the bottom nav. */
function MoreDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalBehavior(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-navy-900/60"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('portal.more')}
        className="absolute inset-y-0 end-0 flex w-72 max-w-[85vw] animate-drawer-in flex-col gap-2 bg-navy-900 p-5 rtl:animate-drawer-in-rtl"
      >
        <div className="mb-4 flex items-center justify-between">
          <LanguageSwitch onDark />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
        <NavItem item={SUPPORT_NAV} onNavigate={onClose} />
        <NavItem item={NOTIFICATIONS_NAV} onNavigate={onClose} />
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-auto flex min-h-11 items-center gap-3 rounded-sm px-3 text-small font-semibold text-on-dark-muted hover:bg-white/10 hover:text-white"
        >
          <LogOut aria-hidden="true" className="size-5 rtl:rotate-180" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

/**
 * Customer portal shell (MW_002 B1): sidebar (start side → right in Arabic; collapsible,
 * collapsed by default on tablet), top bar (title · search · bell · avatar menu) and a
 * bottom navigation + drawer on mobile.
 */
export function PortalLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const title = usePageTitle();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [moreOpen, setMoreOpen] = useState(false);
  const badge =
    useOrders({ tab: 'all', search: '', sort: 'newest' }).data?.pages[0]?.withNewOffers ?? 0;

  const toggle = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!value));
      } catch {
        // ignore
      }
      return !value;
    });
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <a
        href="#portal-main"
        className="sr-only z-50 rounded-sm bg-white p-3 focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t('portal.skipToContent')}
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col gap-2 bg-navy-900 p-3 transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <Link
          to="/app"
          aria-label={t('nav.home')}
          className={cn(
            'mb-4 flex h-14 items-center rounded-sm px-2',
            collapsed && 'justify-center',
          )}
        >
          <Logo onDark compact={collapsed} />
        </Link>
        <nav aria-label={t('portal.mainNav')} className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              collapsed={collapsed}
              badge={item.id === 'orders' ? badge : undefined}
            />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
          <NavItem item={SUPPORT_NAV} collapsed={collapsed} />
          <button
            type="button"
            onClick={() => void signOut()}
            title={collapsed ? t('nav.logout') : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-sm px-3 text-small font-semibold text-on-dark-muted hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            <LogOut aria-hidden="true" className="size-5 shrink-0 rtl:rotate-180" />
            <span className={cn(collapsed && 'sr-only')}>{t('nav.logout')}</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('portal.expandSidebar') : t('portal.collapseSidebar')}
            className="flex min-h-11 items-center justify-center rounded-sm text-on-dark-muted hover:bg-white/10 hover:text-white"
          >
            <ToggleIcon aria-hidden="true" className="size-5 rtl:rotate-180" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <h1 className="min-w-0 flex-1 truncate text-h3">{title}</h1>
          <OrderSearch />
          <NotificationBell />
          <UserMenu />
        </header>

        <main id="portal-main" tabIndex={-1} className="flex-1 px-4 py-6 pb-28 sm:px-6 md:pb-10">
          <div className="mx-auto w-full max-w-site">
            <Outlet />
          </div>
        </main>
      </div>

      <nav
        aria-label={t('portal.mainNav')}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
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
      {moreOpen && <MoreDrawer onClose={() => setMoreOpen(false)} />}
    </div>
  );
}
