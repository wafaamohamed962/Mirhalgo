import {
  Bell,
  Building2,
  LifeBuoy,
  Package,
  PlusCircle,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

export type PortalNavItem = { id: string; to: string; icon: LucideIcon };

/** The 4 main sections (sidebar + mobile bottom nav, spec B1). Labels: `portal.nav.<id>`. */
export const MAIN_NAV: readonly PortalNavItem[] = [
  { id: 'newRequest', to: '/app/new-request', icon: PlusCircle },
  { id: 'orders', to: '/app/orders', icon: Package },
  { id: 'companies', to: '/app/companies', icon: Building2 },
  { id: 'account', to: '/app/account', icon: UserCog },
];

export const SUPPORT_NAV: PortalNavItem = { id: 'support', to: '/app/support', icon: LifeBuoy };
export const NOTIFICATIONS_NAV: PortalNavItem = {
  id: 'notifications',
  to: '/app/notifications',
  icon: Bell,
};

/** Route `handle` of every portal page (shared with the company portal). */
export type { PortalHandle } from '../../../components/portal/usePortalTitle';
