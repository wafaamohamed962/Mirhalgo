-- MW_001 · email_otps (spec 4.3, section 6). Backend only.
-- Stores ONLY HMAC-SHA256(code, OTP_PEPPER) as hex, never the code.

create type public.otp_purpose as enum ('signup', 'reset_password');

create table public.email_otps (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  email          text not null check (email = lower(email)),
  purpose        public.otp_purpose not null,
  code_hash      text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts       smallint not null default 0 check (attempts >= 0),
  expires_at     timestamptz not null,
  consumed_at    timestamptz, -- used successfully (single use)
  invalidated_at timestamptz, -- superseded by a newer code or too many wrong attempts
  ip             inet,
  created_at     timestamptz not null default now()
);

comment on table public.email_otps is 'Email OTP codes (hashed). Backend access only.';

-- lookups: latest code per email + purpose; hourly count per email
create index email_otps_email_purpose_created_idx
  on public.email_otps (email, purpose, created_at desc);
create index email_otps_email_created_idx
  on public.email_otps (email, created_at desc);
create index email_otps_user_id_idx on public.email_otps (user_id);

-- ── RLS: enabled, no policies → no access for anon/authenticated ──
alter table public.email_otps enable row level security;
revoke all on table public.email_otps from anon, authenticated;

-- ────────────────────────────────────────────────────
-- claim_otp_attempt: atomically reserves ONE verification attempt on the newest
-- active code. The row is locked (FOR UPDATE), so parallel requests cannot exceed
-- the attempt limit. The hash comparison itself happens in Node with
-- crypto.timingSafeEqual (spec 4.3).
--
-- status: 'ok'        → attempt reserved, compare code_hash in the backend
--         'none'      → no active code (never sent, already used or superseded)
--         'expired'   → newest active code is past expires_at
--         'exhausted' → max attempts reached; the code is invalidated now
-- ────────────────────────────────────────────────────
create function public.claim_otp_attempt(
  p_email text,
  p_purpose public.otp_purpose,
  p_max_attempts smallint
)
returns table (status text, otp_id uuid, user_id uuid, code_hash text, attempts smallint)
language plpgsql
set search_path = ''
as $$
declare
  v_otp public.email_otps%rowtype;
begin
  select * into v_otp
  from public.email_otps o
  where o.email = p_email
    and o.purpose = p_purpose
    and o.consumed_at is null
    and o.invalidated_at is null
  order by o.created_at desc
  limit 1
  for update;

  if not found then
    return query select 'none'::text, null::uuid, null::uuid, null::text, null::smallint;
    return;
  end if;

  if v_otp.expires_at <= now() then
    return query select 'expired'::text, v_otp.id, v_otp.user_id, null::text, v_otp.attempts;
    return;
  end if;

  if v_otp.attempts >= p_max_attempts then
    update public.email_otps set invalidated_at = now() where id = v_otp.id;
    return query select 'exhausted'::text, v_otp.id, v_otp.user_id, null::text, v_otp.attempts;
    return;
  end if;

  -- alias needed: "attempts" is also an OUT column of this function
  update public.email_otps o set attempts = o.attempts + 1 where o.id = v_otp.id;

  return query
    select 'ok'::text, v_otp.id, v_otp.user_id, v_otp.code_hash, (v_otp.attempts + 1)::smallint;
end;
$$;

-- Functions are executable by PUBLIC by default: restrict to the backend.
revoke execute on function public.claim_otp_attempt(text, public.otp_purpose, smallint)
  from public, anon, authenticated;
grant execute on function public.claim_otp_attempt(text, public.otp_purpose, smallint)
  to service_role;
