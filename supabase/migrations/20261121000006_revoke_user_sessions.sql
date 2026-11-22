-- MW_002 decision 8 (MW_001 follow-up): after a password reset, sign out every session.
--
-- The Auth Admin API changes a password without revoking existing refresh tokens, and its
-- signOut() needs the user's own access token (the reset flow has none). Deleting the
-- user's sessions + refresh tokens makes every refresh fail, so each device is signed out
-- when its current access token expires (≤ 1 hour, the JWT expiry).
-- The reset flow has no session of its own, so "all other sessions" = all sessions.

create function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
-- definer: auth.* tables are not accessible to service_role directly.
security definer
set search_path = ''
as $$
declare
  v_sessions integer;
begin
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_sessions = row_count;
  return v_sessions;
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
