import { MAX_REQUEST_ATTEMPTS, type MeSummary } from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import type { AuthUser } from '../middleware/requireAuth.js';
import { getBalance, grantInitialBalance } from './balance.js';
import { listDraftSummaries } from './orderDrafts.js';

/**
 * GET /api/me/summary (MW_003 B1 page header): first name + gender for the welcome banner,
 * the request balance and the saved drafts, in one call.
 */
export async function getSummary(user: AuthUser): Promise<MeSummary> {
  const { data: profile, error } = await db
    .from('profiles')
    .select('first_name, gender, email_verified_at')
    .eq('id', user.id)
    .single();
  if (error) throw error;

  // Safety net: the grant at verification failed (it is logged, never blocks verifying).
  // Same idempotent key, so this can never add the initial requests twice.
  let remaining = await getBalance(user.id);
  if (remaining === null && profile.email_verified_at) {
    remaining = await grantInitialBalance(user.id);
  }

  return {
    firstName: profile.first_name ?? '',
    gender: profile.gender ?? 'male',
    balance: { remaining: remaining ?? 0, total: MAX_REQUEST_ATTEMPTS },
    drafts: await listDraftSummaries(user.id),
  };
}
