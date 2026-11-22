import { INITIAL_REQUEST_BALANCE } from '@mirhalgo/shared';
import { logEvent } from '../lib/logger.js';
import { db } from '../lib/supabase.js';

/*
 * Request balance (MW_003 B7). Every change goes through SQL functions that write the
 * append-only ledger in the same transaction (grant_balance here, submit_order in B4).
 */

/**
 * The 5 requests a customer receives once the email is verified. Idempotent (ledger key
 * `initial:<id>`, the same key as the MW_001 backfill): calling it again changes nothing.
 */
export async function grantInitialBalance(customerId: string, ip?: string): Promise<number> {
  const { data, error } = await db.rpc('grant_balance', {
    p_customer_id: customerId,
    p_amount: INITIAL_REQUEST_BALANCE,
    p_reason: 'initial_grant',
    p_unique_key: `initial:${customerId}`,
  });
  if (error) throw error;
  logEvent('balance_initial_grant', ip, { userId: customerId });
  return data;
}

/** The current balance, or null when the customer has none yet. */
export async function getBalance(customerId: string): Promise<number | null> {
  const { data, error } = await db
    .from('customer_balances')
    .select('balance')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? null;
}
