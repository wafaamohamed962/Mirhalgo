import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { Database } from '../types/database.js';

const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/**
 * Service-role client: bypasses RLS, used for DB writes and the Auth Admin API.
 * Never call `auth.signIn*` on it: that would replace its service-role credentials
 * with a user session.
 */
export const db = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: serverAuthOptions,
});

/** Throw-away client for one password sign-in, so no session leaks between requests. */
export function createSignInClient() {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: serverAuthOptions,
  });
}
