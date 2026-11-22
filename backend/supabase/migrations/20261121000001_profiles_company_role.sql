-- MW_002 · profiles for company accounts + role in app_metadata (decision 3).
--
-- * first_name / last_name / gender are customer fields: a company profile has none
--   (the representative's name lives in public.companies). Customers still need all three.
-- * Only customers may update their own name/gender (a company changes nothing after
--   submitting; edits come with a future "changes requested" flow).
-- * auth.users.raw_app_meta_data->>'role' is the source of truth (it is in the JWT and only
--   the service role can write it); profiles.role mirrors it. Both are written by the backend.

alter table public.profiles
  alter column first_name drop not null,
  alter column last_name drop not null,
  alter column gender drop not null,
  add constraint profiles_customer_fields_check check (
    role <> 'customer'
    or (first_name is not null and last_name is not null and gender is not null)
  );

drop policy "profiles: owner can update" on public.profiles;

create policy "profiles: customer can update own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id and role = 'customer')
with check ((select auth.uid()) = id and role = 'customer');

-- Backfill: accounts created in MW_001 have no role in app_metadata yet.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', p.role::text)
from public.profiles p
where p.id = u.id
  and (u.raw_app_meta_data ->> 'role') is distinct from p.role::text;
