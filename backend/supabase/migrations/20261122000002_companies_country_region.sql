-- MW_003 A2 · companies: country + region instead of the Egyptian governorate enum, and
-- country-specific legal numbers (spec A2). Replaces MW_002's `egypt_governorate`.
--
--   companies.governorate (enum)            → country_code + region_id (composite FK: the
--                                             region always belongs to the country)
--   CR 1–10 digits / tax 9 digits (global)  → rules per country (EG / SA / AE), unique per
--                                             country (same constraint names, decision 1)
--   company_services.domestic_governorates  → company_domestic_regions (one row per region)
--   domestic_all_governorates               → domestic_all_regions (all regions of the
--                                             company's own country)
--
-- Existing rows are MW_002 companies, all in Egypt: country 'EG', region mapped from the
-- governorate. The migration stops with an error if any value cannot be mapped.

-- governorate enum value → ISO 3166-2 region id (dropped at the end)
create temporary table mw003_governorate_map (slug text primary key, region_id text not null);
insert into mw003_governorate_map (slug, region_id) values
  ('cairo', 'EG-C'), ('giza', 'EG-GZ'), ('alexandria', 'EG-ALX'), ('qalyubia', 'EG-KB'),
  ('sharqia', 'EG-SHR'), ('dakahlia', 'EG-DK'), ('gharbia', 'EG-GH'), ('monufia', 'EG-MNF'),
  ('beheira', 'EG-BH'), ('kafr_el_sheikh', 'EG-KFS'), ('damietta', 'EG-DT'),
  ('port_said', 'EG-PTS'), ('ismailia', 'EG-IS'), ('suez', 'EG-SUZ'),
  ('north_sinai', 'EG-SIN'), ('south_sinai', 'EG-JS'), ('red_sea', 'EG-BA'),
  ('faiyum', 'EG-FYM'), ('beni_suef', 'EG-BNS'), ('minya', 'EG-MN'), ('asyut', 'EG-AST'),
  ('sohag', 'EG-SHG'), ('qena', 'EG-KN'), ('luxor', 'EG-LX'), ('aswan', 'EG-ASN'),
  ('new_valley', 'EG-WAD'), ('matrouh', 'EG-MT');

-- ── companies: country + region ─────────────────────────────────────────────
alter table public.companies
  add column country_code char(2),
  add column region_id text;

update public.companies c
set country_code = 'EG', region_id = m.region_id
from mw003_governorate_map m
where m.slug = c.governorate::text;

do $$
begin
  if exists (select 1 from public.companies where region_id is null) then
    raise exception 'MW_003: a company governorate could not be mapped to a region';
  end if;
end;
$$;

alter table public.companies
  alter column country_code set not null,
  alter column region_id set not null,
  add constraint companies_country_fkey
    foreign key (country_code) references public.countries (code),
  add constraint companies_region_fkey
    foreign key (country_code, region_id) references public.regions (country_code, id),
  -- target of company_domestic_regions' foreign key (same country as the company)
  add constraint companies_id_country_key unique (id, country_code),
  drop column governorate;

create index companies_region_idx on public.companies (region_id);

comment on column public.companies.commercial_register_number is
  'Business registration number: EG commercial register · SA CR · AE trade license.';
comment on column public.companies.tax_number is
  'Tax number: EG tax card · SA VAT · AE TRN. Digits only.';

-- ── legal numbers: rules per country, unique per country ────────────────────
-- Keep in sync with COMPANY_COUNTRY_RULES (shared/src/company.ts).
alter table public.companies
  drop constraint companies_commercial_register_number_check,
  drop constraint companies_tax_number_check,
  drop constraint companies_commercial_register_number_key,
  drop constraint companies_tax_number_key,
  add constraint companies_legal_numbers_check check (
    case country_code
      when 'EG' then commercial_register_number ~ '^[0-9]{1,10}$' and tax_number ~ '^[0-9]{9}$'
      when 'SA' then commercial_register_number ~ '^[0-9]{10}$' and tax_number ~ '^[0-9]{15}$'
      when 'AE' then commercial_register_number ~ '^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$'
                 and tax_number ~ '^[0-9]{15}$'
      else false -- a new sign-up country needs its rules here first
    end
  ),
  -- same names as MW_002: the API maps them to COMPANY_ALREADY_REGISTERED (decision 1)
  add constraint companies_commercial_register_number_key
    unique (country_code, commercial_register_number),
  add constraint companies_tax_number_key unique (country_code, tax_number);

-- ── domestic coverage: one row per covered region ───────────────────────────
create table public.company_domestic_regions (
  company_id   uuid not null,
  country_code char(2) not null,
  region_id    text not null,
  primary key (company_id, region_id),
  constraint company_domestic_regions_company_fkey foreign key (company_id, country_code)
    references public.companies (id, country_code) on update cascade on delete cascade,
  -- the region belongs to the company's own country
  constraint company_domestic_regions_region_fkey foreign key (country_code, region_id)
    references public.regions (country_code, id)
);

comment on table public.company_domestic_regions is
  'Regions covered by a domestic shipping company (MW_003). Empty + domestic_all_regions = all.';

create index company_domestic_regions_region_idx on public.company_domestic_regions (region_id);

insert into public.company_domestic_regions (company_id, country_code, region_id)
select s.company_id, c.country_code, m.region_id
from public.company_services s
join public.companies c on c.id = s.company_id
cross join lateral unnest(s.domestic_governorates) as g (slug)
join mw003_governorate_map m on m.slug = g.slug::text;

do $$
begin
  if (select coalesce(sum(cardinality(domestic_governorates)), 0) from public.company_services)
     <> (select count(*) from public.company_domestic_regions) then
    raise exception 'MW_003: a covered governorate could not be mapped to a region';
  end if;
end;
$$;

alter table public.company_services
  drop constraint company_services_all_governorates_check,
  drop column domestic_governorates;
alter table public.company_services
  rename column domestic_all_governorates to domestic_all_regions;

alter table public.company_domestic_regions enable row level security;
revoke all on table public.company_domestic_regions from anon, authenticated;
create policy "company_domestic_regions: owner can read"
on public.company_domestic_regions for select to authenticated
using ((select auth.uid()) = company_id);
grant select on table public.company_domestic_regions to authenticated;

-- ── create_company_registration: + domestic regions ─────────────────────────
drop function public.create_company_registration(uuid, text, text, jsonb, jsonb, jsonb, jsonb);

create function public.create_company_registration(
  p_user_id          uuid,
  p_email            text,
  p_phone            text,
  p_company          jsonb,  -- columns of public.companies (snake_case), without id/timestamps
  p_services         jsonb,  -- columns of public.company_services, without company_id/timestamps
  p_domestic_regions text[], -- region ids of the company's country (empty: none, or all)
  p_documents        jsonb,  -- array of {type, storage_bucket, storage_path, original_name, mime_type, size_bytes}
  p_consent          jsonb   -- {terms_version, submit_ip, user_agent}
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
  v_all_regions boolean := coalesce((p_services ->> 'domestic_all_regions')::boolean, false);
begin
  -- the role in app_metadata (source of truth) must already say "company"
  if (select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = p_user_id)
     is distinct from 'company' then
    raise exception 'auth user % is not a company account', p_user_id
      using errcode = 'check_violation';
  end if;

  -- "All regions" is stored as the flag only (decision 15)
  if v_all_regions and cardinality(coalesce(p_domestic_regions, '{}')) > 0 then
    raise exception 'domestic regions must be empty when all regions are covered'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, role, email, phone)
  values (p_user_id, 'company', p_email, p_phone);

  insert into public.companies (
    id, legal_name, representative_name, representative_title, whatsapp, landline, website,
    country_code, region_id, city, street, activities, other_activity, years_in_business,
    commercial_register_number, tax_number, notes
  )
  select
    p_user_id, c.legal_name, c.representative_name, c.representative_title, c.whatsapp,
    c.landline, c.website, c.country_code, c.region_id, c.city, c.street, c.activities,
    c.other_activity, c.years_in_business, c.commercial_register_number, c.tax_number, c.notes
  from jsonb_populate_record(null::public.companies, p_company) c;

  insert into public.company_services (
    company_id, international_modes, international_scope, international_countries,
    international_regions, domestic_all_regions, vehicle_types, vehicle_type_other, fleet_size,
    china_sites, china_site_other, china_services
  )
  select
    p_user_id,
    coalesce(s.international_modes, '{}'),
    s.international_scope,
    coalesce(s.international_countries, '{}'),
    coalesce(s.international_regions, '{}'),
    v_all_regions,
    coalesce(s.vehicle_types, '{}'),
    s.vehicle_type_other,
    s.fleet_size,
    coalesce(s.china_sites, '{}'),
    s.china_site_other,
    coalesce(s.china_services, '{}')
  from jsonb_populate_record(null::public.company_services, p_services) s;

  -- the composite foreign key rejects a region of another country
  insert into public.company_domestic_regions (company_id, country_code, region_id)
  select p_user_id, c.country_code, r.region_id
  from public.companies c
  cross join unnest(coalesce(p_domestic_regions, '{}')) as r (region_id)
  where c.id = p_user_id;

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

revoke execute on function public.create_company_registration(
  uuid, text, text, jsonb, jsonb, text[], jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_company_registration(
  uuid, text, text, jsonb, jsonb, text[], jsonb, jsonb
) to service_role;

-- nothing uses the Egyptian-only enum any more
drop type public.egypt_governorate;

drop table mw003_governorate_map;
