import {
  Building2,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { CompanyCounts } from '@mirhalgo/shared';

export type CompanyNavItem = {
  id: 'overview' | 'requests' | 'offers' | 'competitors' | 'inquiries' | 'settings';
  to: string;
  icon: LucideIcon;
  /** The count shown as a badge (spec B2), from the dashboard. */
  badge?: keyof CompanyCounts;
};

/** The 6 sections (spec B2). Labels: `companyPortal.nav.<id>`, badge meaning: `…badges.<id>`. */
export const COMPANY_NAV: readonly CompanyNavItem[] = [
  { id: 'overview', to: '/company/overview', icon: LayoutDashboard },
  { id: 'requests', to: '/company/requests', icon: Inbox, badge: 'requestsWithoutOffer' },
  { id: 'offers', to: '/company/offers', icon: FileCheck2, badge: 'offersUnderReview' },
  { id: 'competitors', to: '/company/competitors', icon: Building2 },
  { id: 'inquiries', to: '/company/inquiries', icon: MessagesSquare, badge: 'inquiriesAwaiting' },
  { id: 'settings', to: '/company/settings', icon: Settings },
];
