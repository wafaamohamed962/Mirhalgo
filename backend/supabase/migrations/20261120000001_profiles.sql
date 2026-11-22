-- MW_001 · profiles (spec section 6)
-- One row per auth user. Created by the backend (service role) at signup.
-- Owner can read their row and update ONLY first_name / last_name / gender:
-- never role, email, phone or verification fields (spec section 5).

create type public.user_role as enum ('customer', 'company', 'admin');
create type public.gender as enum ('male', 'female');

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              public.user_role not null default 'customer',
  first_name        text not null check (char_length(first_name) between 2 and 50),
  last_name         text not null check (char_length(last_name) between 2 and 50),
  gender            public.gender not null,
  email             text not null unique check (email = lower(email)),
  phone             text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Customer/company profile, 1:1 with auth.users. Written by the backend.';
comment on column public.profiles.phone is 'E.164, e.g. +201012345678';

-- keep updated_at fresh
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles: owner can read"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles: owner can update"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No insert/delete policies: only the backend (service role, bypasses RLS) writes rows.

-- Column-level privileges: clients may update only these columns.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name, last_name, gender) on table public.profiles to authenticated;
