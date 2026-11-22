-- MW_002 · registration + cleanup functions (spec A3 "all-or-nothing", decision 10).
--
-- The backend flow is: create the auth user (Admin API, email unconfirmed,
-- app_metadata.role = 'company') → upload the files → create_company_registration() →
-- send the OTP. All rows are written by ONE function call = one transaction: either every
-- row exists or none does. If the call fails, the backend deletes the uploaded files and the
-- auth user (compensation), so nothing partial is left.

create function public.create_company_registration(
  p_user_id   uuid,
  p_email     text,
  p_phone     text,
  p_company   jsonb, -- columns of public.companies (snake_case), without id/timestamps
  p_services  jsonb, -- columns of public.company_services, without company_id/timestamps
  p_documents jsonb, -- array of {type, storage_bucket, storage_path, original_name, mime_type, size_bytes}
  p_consent   jsonb  -- {terms_version, submit_ip, user_agent}
)
returns table (application_id uuid, reference_number text)
language plpgsql
-- definer: reads auth.users (app_metadata role check). Executable by service_role only.
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_application_id uuid;
  v_reference text;
begin
  -- the role in app_metadata (source of truth) must already say "company"
  if (select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = p_user_id)
     is distinct from 'company' then
    raise exception 'auth user % is not a company account', p_user_id
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, role, email, phone)
  values (p_user_id, 'company', p_email, p_phone);

  insert into public.companies (
    id, legal_name, representative_name, representative_title, whatsapp, landline, website,
    governorate, city, street, activities, other_activity, years_in_business,
    commercial_register_number, tax_number, notes
  )
  select
    p_user_id, c.legal_name, c.representative_name, c.representative_title, c.whatsapp,
    c.landline, c.website, c.governorate, c.city, c.street, c.activities, c.other_activity,
    c.years_in_business, c.commercial_register_number, c.tax_number, c.notes
  from jsonb_populate_record(null::public.companies, p_company) c;

  insert into public.company_services (
    company_id, international_modes, international_scope, international_countries,
    international_regions, domestic_all_governorates, domestic_governorates, vehicle_types,
    vehicle_type_other, fleet_size, china_sites, china_site_other, china_services
  )
  select
    p_user_id,
    coalesce(s.international_modes, '{}'),
    s.international_scope,
    coalesce(s.international_countries, '{}'),
    coalesce(s.international_regions, '{}'),
    coalesce(s.domestic_all_governorates, false),
    coalesce(s.domestic_governorates, '{}'),
    coalesce(s.vehicle_types, '{}'),
    s.vehicle_type_other,
    s.fleet_size,
    coalesce(s.china_sites, '{}'),
    s.china_site_other,
    coalesce(s.china_services, '{}')
  from jsonb_populate_record(null::public.company_services, p_services) s;

  insert into public.company_documents (
    company_id, type, storage_bucket, storage_path, original_name, mime_type, size_bytes
  )
  select p_user_id, d.type, d.storage_bucket, d.storage_path, d.original_name, d.mime_type,
         d.size_bytes
  from jsonb_populate_recordset(null::public.company_documents, p_documents) d;

  -- required documents (spec A2 Step 3); the API checks this too
  if (select count(*) from public.company_documents d
      where d.company_id = p_user_id and d.type in ('commercial_register', 'tax_card')) <> 2 then
    raise exception 'commercial register and tax card documents are required'
      using errcode = 'check_violation';
  end if;

  insert into public.company_applications (
    company_id, declaration_accepted_at, terms_version, terms_accepted_at, submit_ip, user_agent
  )
  values (
    p_user_id, now(), p_consent ->> 'terms_version', now(),
    (p_consent ->> 'submit_ip')::inet, p_consent ->> 'user_agent'
  )
  returning id, reference_number into v_application_id, v_reference;

  return query select v_application_id, v_reference;
end;
$$;

-- Unverified applications older than p_older_than (decision 10). Returns the user ids and
-- their files; the backend deletes the files (Storage API) and then the auth user, which
-- cascades to every row. Scheduling comes later.
create function public.list_expired_company_registrations(
  p_older_than interval default interval '7 days',
  p_limit integer default 100
)
returns table (user_id uuid, documents jsonb)
language sql
stable
set search_path = ''
as $$
  select
    a.company_id,
    coalesce(
      jsonb_agg(jsonb_build_object('bucket', d.storage_bucket, 'path', d.storage_path))
        filter (where d.id is not null),
      '[]'::jsonb
    )
  from public.company_applications a
  join public.profiles p on p.id = a.company_id
  left join public.company_documents d on d.company_id = a.company_id
  where a.status = 'pending_verification'
    and p.email_verified_at is null
    and a.created_at < now() - p_older_than
  group by a.company_id
  order by min(a.created_at)
  limit p_limit;
$$;

revoke execute on function public.create_company_registration(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke execute on function public.list_expired_company_registrations(interval, integer)
  from public, anon, authenticated;

grant execute on function public.create_company_registration(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.list_expired_company_registrations(interval, integer)
  to service_role;
