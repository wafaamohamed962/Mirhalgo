-- MW_002 · company applications, status lifecycle + history (spec A3, A4).
--
--   pending_verification → pending_review → approved | rejected | changes_requested
--   changes_requested    → pending_review (resubmission, future flow)
--
-- Every status change (and the initial status) is written to application_status_history by
-- a trigger, so it cannot be skipped. Status changes go through
-- transition_application_status(), which records the actor.

create type public.application_status as enum (
  'pending_verification', 'pending_review', 'approved', 'rejected', 'changes_requested'
);
create type public.status_actor_type as enum ('system', 'company', 'admin');

-- ── reference number MG-C-YYYY-000123 (decision 9) ──────────────────────────
create sequence public.company_application_ref_seq;

create function public.next_company_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'MG-C-' || to_char(now() at time zone 'Africa/Cairo', 'YYYY') || '-'
         || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.company_application_ref_seq') as n) s;
$$;

-- ── applications: one per company, with consent + audit metadata ────────────
create table public.company_applications (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null unique references public.companies (id) on delete cascade,
  reference_number        text not null unique default public.next_company_reference()
                          check (reference_number ~ '^MG-C-[0-9]{4}-[0-9]{6,}$'),
  status                  public.application_status not null default 'pending_verification',
  submitted_at            timestamptz not null default now(),
  declaration_accepted_at timestamptz not null,
  terms_version           text not null check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  terms_accepted_at       timestamptz not null,
  submit_ip               inet,
  user_agent              text check (char_length(user_agent) <= 512),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.company_applications is
  'Company registration application (MW_002). Status changes only via transition_application_status().';

-- admin review queue + cleanup of unverified applications
create index company_applications_status_created_idx
  on public.company_applications (status, created_at);

create trigger company_applications_set_updated_at
before update on public.company_applications
for each row execute function public.set_updated_at();

-- ── history ─────────────────────────────────────────────────────────────────
create table public.application_status_history (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.company_applications (id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  actor_type     public.status_actor_type not null,
  actor_id       uuid, -- no FK: history survives the deletion of an admin account
  note           text check (char_length(note) <= 1000),
  created_at     timestamptz not null default now()
);

comment on table public.application_status_history is 'Audit log of application status changes.';

create index application_status_history_application_idx
  on public.application_status_history (application_id, created_at);

create function public.is_allowed_status_transition(
  p_from public.application_status,
  p_to public.application_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('pending_verification'::public.application_status, 'pending_review'::public.application_status),
    ('pending_review', 'approved'),
    ('pending_review', 'rejected'),
    ('pending_review', 'changes_requested'),
    ('changes_requested', 'pending_review')
  );
$$;

-- AFTER trigger: validates the transition (raising rolls the change back) and logs it.
-- The actor comes from transaction-local settings set by transition_application_status();
-- anything else (e.g. the initial insert) is logged as 'system'.
create function public.log_application_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from public.application_status := case when tg_op = 'UPDATE' then old.status end;
begin
  if tg_op = 'INSERT' and new.status <> 'pending_verification' then
    raise exception 'a new application must start in pending_verification'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' then
    if new.status = old.status then
      return null;
    end if;
    if not public.is_allowed_status_transition(old.status, new.status) then
      raise exception 'status transition % -> % is not allowed', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.application_status_history
    (application_id, from_status, to_status, actor_type, actor_id, note)
  values (
    new.id,
    v_from,
    new.status,
    coalesce(nullif(current_setting('mirhalgo.status_actor_type', true), ''), 'system')
      ::public.status_actor_type,
    nullif(current_setting('mirhalgo.status_actor_id', true), '')::uuid,
    nullif(current_setting('mirhalgo.status_note', true), '')
  );
  return null;
end;
$$;

create trigger company_applications_log_status
after insert or update of status on public.company_applications
for each row execute function public.log_application_status();

-- Changes the status and records who did it. Raises if the transition is not allowed.
create function public.transition_application_status(
  p_application_id uuid,
  p_to public.application_status,
  p_actor_type public.status_actor_type,
  p_actor_id uuid default null,
  p_note text default null
)
returns public.application_status
language plpgsql
set search_path = ''
as $$
declare
  v_status public.application_status;
begin
  perform set_config('mirhalgo.status_actor_type', p_actor_type::text, true);
  perform set_config('mirhalgo.status_actor_id', coalesce(p_actor_id::text, ''), true);
  perform set_config('mirhalgo.status_note', coalesce(p_note, ''), true);

  update public.company_applications
  set status = p_to
  where id = p_application_id
  returning status into v_status;

  -- do not leak the actor into later statements of the same transaction
  perform set_config('mirhalgo.status_actor_type', '', true);
  perform set_config('mirhalgo.status_actor_id', '', true);
  perform set_config('mirhalgo.status_note', '', true);

  if v_status is null then
    raise exception 'application % not found', p_application_id using errcode = 'no_data_found';
  end if;
  return v_status;
end;
$$;

-- ── RLS + privileges ──────────────────────────────────────────────────────
-- The company reads its own application and history (not the audit IP/user agent, not
-- the actor or internal notes). It can never change the status (spec A5).
alter table public.company_applications enable row level security;
alter table public.application_status_history enable row level security;

revoke all on table public.company_applications, public.application_status_history
  from anon, authenticated;
revoke all on sequence public.company_application_ref_seq from anon, authenticated;

create policy "company_applications: owner can read"
on public.company_applications for select to authenticated
using ((select auth.uid()) = company_id);

create policy "application_status_history: owner can read"
on public.application_status_history for select to authenticated
using (
  exists (
    select 1 from public.company_applications a
    where a.id = application_id and a.company_id = (select auth.uid())
  )
);

grant select (id, company_id, reference_number, status, submitted_at, created_at, updated_at)
  on table public.company_applications to authenticated;
grant select (id, application_id, from_status, to_status, created_at)
  on table public.application_status_history to authenticated;

revoke execute on function public.next_company_reference() from public, anon, authenticated;
revoke execute on function public.is_allowed_status_transition(
  public.application_status, public.application_status
) from public, anon, authenticated;
revoke execute on function public.log_application_status() from public, anon, authenticated;
revoke execute on function public.transition_application_status(
  uuid, public.application_status, public.status_actor_type, uuid, text
) from public, anon, authenticated;

grant usage on sequence public.company_application_ref_seq to service_role;
grant execute on function public.next_company_reference() to service_role;
grant execute on function public.is_allowed_status_transition(
  public.application_status, public.application_status
) to service_role;
grant execute on function public.transition_application_status(
  uuid, public.application_status, public.status_actor_type, uuid, text
) to service_role;
