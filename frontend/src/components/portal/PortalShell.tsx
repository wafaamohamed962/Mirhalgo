import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '../layout/Logo';
import { cn } from '../../lib/utils';

/**
 * The frame both portals share (MW_002 B1, MW_004 B2): a sidebar on the start side (right in
 * Arabic), collapsible; a sticky top bar; the page in `main`. Each portal fills the slots.
 */
export function PortalShell({
  homeTo,
  labels,
  collapsed,
  onToggle,
  brand,
  nav,
  sidebarFooter,
  header,
  mobile,
  mainClassName,
}: {
  homeTo: string;
  labels: { home: string; nav: string; skip: string; collapse: string; expand: string };
  collapsed: boolean;
  onToggle: () => void;
  /** Under the logo, hidden while collapsed (the company portal's subtitle). */
  brand?: ReactNode;
  nav: ReactNode;
  sidebarFooter: ReactNode;
  header: ReactNode;
  /** Mobile navigation (bottom bar, drawer), rendered after the page. */
  mobile?: ReactNode;
  mainClassName?: string;
}) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <div className="flex min-h-dvh bg-slate-50 print:block print:min-h-0 print:bg-white">
      <a
        href="#portal-main"
        className="sr-only z-50 rounded-sm bg-white p-3 focus:not-sr-only focus:fixed focus:start-3 focus:top-3 print:hidden"
      >
        {labels.skip}
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col gap-2 bg-navy-900 p-3 transition-[width] duration-200 ease-out md:flex print:hidden!',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <Link
          to={homeTo}
          aria-label={labels.home}
          className={cn(
            'mb-4 flex h-14 items-center rounded-sm px-2',
            collapsed && 'justify-center',
          )}
        >
          <Logo onDark compact={collapsed} />
        </Link>
        {!collapsed && brand}
        <nav aria-label={labels.nav} className="flex flex-col gap-1">
          {nav}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
          {sidebarFooter}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? labels.expand : labels.collapse}
            className="flex min-h-11 items-center justify-center rounded-sm text-on-dark-muted hover:bg-white/10 hover:text-white"
          >
            <ToggleIcon aria-hidden="true" className="size-5 rtl:rotate-180" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 print:hidden!">
          {header}
        </header>

        <main
          id="portal-main"
          tabIndex={-1}
          className={cn('flex-1 px-4 py-6 sm:px-6 print:p-0', mainClassName)}
        >
          <div className="mx-auto w-full max-w-site">
            <Outlet />
          </div>
        </main>
      </div>

      {mobile}
    </div>
  );
}
