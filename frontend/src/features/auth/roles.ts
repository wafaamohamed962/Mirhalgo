import { matchPath } from 'react-router';
import type { Session } from '@supabase/supabase-js';
import { USER_ROLES, type CompanyStatus, type UserRole } from '@mirhalgo/shared';

/**
 * The role comes from the JWT (`app_metadata.role`, written only by the backend:
 * MW_002 decision 3), so routing needs no extra request.
 */
export function roleOf(session: Session | null): UserRole | null {
  const role: unknown = session?.user.app_metadata?.role;
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

const CUSTOMER_HOME = '/app/new-request';
export const COMPANY_PORTAL_HOME = '/company/overview';
export const COMPANY_STATUS_PAGE = '/company/application-status';

/**
 * Where each account lands after login (MW_002 A6, MW_004 A1): a customer on New Request; a
 * company by its application status (`approved` → the company portal, anything else, or an
 * unknown status → the status page). Admins have no UI yet.
 */
export function homePath(role: UserRole | null, companyStatus: CompanyStatus | null = null) {
  if (role === 'customer') return CUSTOMER_HOME;
  if (role === 'company') {
    return companyStatus === 'approved' ? COMPANY_PORTAL_HOME : COMPANY_STATUS_PAGE;
  }
  return '/';
}

/** Who is looking: enough to pick a page they are allowed to open. */
export type Viewer = {
  isVerified: boolean;
  role: UserRole | null;
  /** Companies only (MW_004): decides which company pages they can open. */
  companyStatus?: CompanyStatus | null;
};

/** Customer pages whose logical parent is not the portal home. */
const CUSTOMER_PARENTS: ReadonlyArray<[pattern: string, parent: string]> = [
  ['/app/orders/:id', '/app/orders'],
  ['/app/companies/:id', '/app/companies'],
  ['/app/support/tickets/:id', '/app/support'],
  ['/app/account/:section', '/app/account'],
];

/**
 * Where "Back" goes when there is no previous page inside the app (an email link, a new tab):
 * the logical parent of `pathname`, always a page this viewer can open.
 * - guest (or a sign-up waiting for its code): home;
 * - customer: the list of a detail page, else New Request;
 * - company: its home for its status: the Overview (approved) or the application status; from
 *   that home itself: the landing page.
 */
export function backFallback(pathname: string, viewer: Viewer): string {
  if (!viewer.isVerified || !viewer.role) return '/';
  if (viewer.role === 'company') {
    const home = homePath('company', viewer.companyStatus);
    return pathname === home ? '/' : home;
  }
  if (viewer.role === 'customer') {
    const parent = CUSTOMER_PARENTS.find(([pattern]) => matchPath(pattern, pathname));
    return parent?.[1] ?? CUSTOMER_HOME;
  }
  return '/'; // admins have no UI yet
}
