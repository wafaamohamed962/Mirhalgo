/**
 * The Supabase project URL must be the bare origin (e.g. https://<ref>.supabase.co).
 * supabase-js appends /rest/v1, /auth/v1 and /storage/v1 itself, so a URL copied from the
 * dashboard's "REST URL" (…/rest/v1/) makes every query fail with PGRST125 and every
 * sign-in fail without an error code.
 */
export function isSupabaseProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && // http only for a local stack
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export const SUPABASE_URL_RULE =
  'must be the project URL only, e.g. https://<ref>.supabase.co (no /rest/v1 or other path)';
