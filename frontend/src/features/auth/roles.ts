import type { Session } from '@supabase/supabase-js';
import { USER_ROLES, type UserRole } from '@mirhalgo/shared';

/**
 * The role comes from the JWT (`app_metadata.role`, written only by the backend:
 * MW_002 decision 3), so routing needs no extra request.
 */
export function roleOf(session: Session | null): UserRole | null {
  const role: unknown = session?.user.app_metadata?.role;
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

/** Where each role lands after login (MW_002 A6). Admins have no UI yet. */
export function homePath(role: UserRole | null): string {
  if (role === 'customer') return '/app';
  if (role === 'company') return '/application-status';
  return '/';
}
