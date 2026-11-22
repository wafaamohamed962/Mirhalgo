-- MW_003 B3 · server drafts + uploads before submit (spec B2 "Drafts", B7 "Uploads", B9).
--
-- order_drafts:  one active draft per customer and service, saved automatically by the form
--                (payload = the form values, ≤ 64 KB), so it works across devices. Drafts never
--                touch the request balance. Deleted after a successful submit (B4) and 30 days
--                after the last save (cleanup).
-- order_uploads: every file uploaded before submit (one per request, with its own progress
--                bar). Attached to a draft (draft_id) or, after submit, to an order (order_id,
--                foreign key added in B4). Files attached to neither for 24 hours are deleted
--                by the cleanup job. The storage location is never readable by clients.
-- Bucket order-attachments: private, random names, no public URLs (backend only).

create type public.service_type as enum ('international', 'domestic', 'china');
create type public.upload_purpose as enum (
  'packing_list', 'msds', 'invoice', 'document', 'screenshot'
);

create table public.order_drafts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles (id) on delete cascade,
  service      public.service_type not null,
  payload      jsonb not null default '{}'
               check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536),
  form_version text not null check (form_version ~ '^[a-z0-9_.@-]{1,40}$'), -- e.g. international@1
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint order_drafts_customer_service_key unique (customer_id, service)
);

comment on table public.order_drafts is
  'New Request drafts (MW_003 B3): one per customer and service. Written by the backend only.';

create table public.order_uploads (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles (id) on delete cascade,
  purpose       public.upload_purpose not null,
  storage_path  text not null unique check (char_length(storage_path) <= 200),
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type     text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes    integer not null check (size_bytes between 1 and 10485760),
  draft_id      uuid references public.order_drafts (id) on delete set null,
  order_id      uuid, -- foreign key added with the orders table (B4)
  created_at    timestamptz not null default now(),
  constraint order_uploads_one_owner_check check (draft_id is null or order_id is null),
  -- screenshots are images (spec B5)
  constraint order_uploads_screenshot_check
    check (purpose <> 'screenshot' or mime_type in ('image/jpeg', 'image/png', 'image/webp'))
);

comment on table public.order_uploads is
  'Files uploaded for a draft / order (MW_003 B3). Unattached for 24 h = deleted by the cleanup.';

create index order_uploads_customer_idx on public.order_uploads (customer_id);
create index order_uploads_draft_idx on public.order_uploads (draft_id);
create index order_uploads_orphan_idx on public.order_uploads (created_at)
  where draft_id is null and order_id is null;

-- ── RLS: the owner reads its drafts and file metadata; no client writes ─────
alter table public.order_drafts enable row level security;
alter table public.order_uploads enable row level security;
revoke all on table public.order_drafts, public.order_uploads from anon, authenticated;

create policy "order_drafts: owner can read"
on public.order_drafts for select to authenticated
using ((select auth.uid()) = customer_id);

create policy "order_uploads: owner can read"
on public.order_uploads for select to authenticated
using ((select auth.uid()) = customer_id);

grant select on table public.order_drafts to authenticated;
-- metadata only, never the storage location
grant select (id, customer_id, purpose, original_name, mime_type, size_bytes, draft_id,
              order_id, created_at)
  on table public.order_uploads to authenticated;

-- ── save_order_draft(): upsert + keep exactly the listed files attached ─────
create function public.save_order_draft(
  p_customer_id  uuid,
  p_service      public.service_type,
  p_payload      jsonb,
  p_form_version text,
  p_upload_ids   uuid[]
)
returns table (draft_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_draft uuid;
  v_ids uuid[] := coalesce(p_upload_ids, '{}');
begin
  if (select role from public.profiles where id = p_customer_id) is distinct from 'customer' then
    raise exception 'only customers have drafts' using errcode = 'check_violation';
  end if;
  if cardinality(v_ids) > 20 then
    raise exception 'too many files' using errcode = 'check_violation';
  end if;

  insert into public.order_drafts (customer_id, service, payload, form_version)
  values (p_customer_id, p_service, p_payload, p_form_version)
  on conflict (customer_id, service) do update
  set payload = excluded.payload, form_version = excluded.form_version, updated_at = now()
  returning id into v_draft;

  -- every listed file: this customer's, not part of an order, free or already in this draft
  if (select count(*) from public.order_uploads u
      where u.id = any(v_ids) and u.customer_id = p_customer_id and u.order_id is null
        and (u.draft_id is null or u.draft_id = v_draft)) <> cardinality(v_ids) then
    raise exception 'invalid upload' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.order_uploads u
      where u.id = any(v_ids) and u.purpose = 'screenshot') > 10 then
    raise exception 'too many screenshots' using errcode = 'check_violation';
  end if;

  update public.order_uploads u set draft_id = v_draft where u.id = any(v_ids);
  -- removed from the form: back to "unattached" (deleted by the cleanup)
  update public.order_uploads u set draft_id = null
  where u.draft_id = v_draft and not (u.id = any(v_ids));

  return query select d.id, d.updated_at from public.order_drafts d where d.id = v_draft;
end;
$$;

-- ── cleanup lists (the backend removes the files, then the rows) ────────────
create function public.list_orphan_uploads(
  p_older_than interval default interval '24 hours',
  p_limit integer default 200
)
returns table (upload_id uuid, storage_path text)
language sql
stable
set search_path = ''
as $$
  select u.id, u.storage_path
  from public.order_uploads u
  where u.draft_id is null and u.order_id is null and u.created_at < now() - p_older_than
  order by u.created_at
  limit p_limit;
$$;

create function public.list_expired_drafts(
  p_older_than interval default interval '30 days',
  p_limit integer default 100
)
returns table (draft_id uuid, files jsonb)
language sql
stable
set search_path = ''
as $$
  select
    d.id,
    coalesce(
      jsonb_agg(jsonb_build_object('id', u.id, 'path', u.storage_path))
        filter (where u.id is not null),
      '[]'::jsonb
    )
  from public.order_drafts d
  left join public.order_uploads u on u.draft_id = d.id
  where d.updated_at < now() - p_older_than
  group by d.id
  order by min(d.updated_at)
  limit p_limit;
$$;

-- ── job leases: one cleanup run at a time across API instances ──────────────
-- (PostgREST calls are separate transactions, so a session advisory lock cannot span the run.)
create table public.job_leases (
  name         text primary key check (name ~ '^[a-z_]{2,40}$'),
  locked_until timestamptz not null
);
alter table public.job_leases enable row level security;
revoke all on table public.job_leases from anon, authenticated;

create function public.claim_job_lease(p_name text, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_leases as l (name, locked_until)
  values (p_name, now() + make_interval(secs => p_seconds))
  on conflict (name) do update
  set locked_until = excluded.locked_until
  where l.locked_until < now();
  return found;
end;
$$;

revoke execute on function public.save_order_draft(uuid, public.service_type, jsonb, text, uuid[])
  from public, anon, authenticated;
revoke execute on function public.list_orphan_uploads(interval, integer) from public, anon, authenticated;
revoke execute on function public.list_expired_drafts(interval, integer) from public, anon, authenticated;
revoke execute on function public.claim_job_lease(text, integer) from public, anon, authenticated;
grant execute on function public.save_order_draft(uuid, public.service_type, jsonb, text, uuid[])
  to service_role;
grant execute on function public.list_orphan_uploads(interval, integer) to service_role;
grant execute on function public.list_expired_drafts(interval, integer) to service_role;
grant execute on function public.claim_job_lease(text, integer) to service_role;

-- ── private bucket (second line behind the API's content checks) ────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-attachments', 'order-attachments', false, 10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "order attachments: backend only"
on storage.objects
as restrictive
for all
to anon, authenticated
using (bucket_id <> 'order-attachments')
with check (bucket_id <> 'order-attachments');
