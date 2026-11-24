import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LogOut, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/** A portal sidebar / drawer link, with an optional count badge (and its meaning for readers). */
export function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
  badge,
  badgeLabel,
  onNavigate,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  badge?: number;
  badgeLabel?: string;
  onNavigate?: () => void;
}) {
  const { i18n } = useTranslation();
  const count = badge ? badge.toLocaleString(i18n.language) : '';
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      // with a badge, an explicit name: the text alone reads "Requests5requests…" (no spaces).
      // It starts with the visible label (WCAG 2.5.3).
      aria-label={badge ? [label, count, badgeLabel].filter(Boolean).join(' ') : undefined}
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
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn(collapsed && 'sr-only')}>{label}</span>
      {badge ? (
        <span
          className={cn(
            'rounded-full bg-violet-600 px-2 text-caption text-white',
            collapsed ? 'absolute end-1 top-1 px-1.5' : 'ms-auto',
          )}
        >
          {count}
        </span>
      ) : null}
    </NavLink>
  );
}

/** Logout in a portal sidebar or drawer (spec 4.5: → `/`). */
export function SidebarLogout({
  onLogout,
  collapsed,
}: {
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onLogout}
      title={collapsed ? t('nav.logout') : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-sm px-3 text-small font-semibold text-on-dark-muted hover:bg-white/10 hover:text-white',
        collapsed && 'justify-center px-0',
      )}
    >
      <LogOut aria-hidden="true" className="size-5 shrink-0 rtl:rotate-180" />
      <span className={cn(collapsed && 'sr-only')}>{t('nav.logout')}</span>
    </button>
  );
}
