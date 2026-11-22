-- MW_002 · companies, company_services, company_documents (spec A2, A4).
-- Enum values = the ids in packages/shared/src/company.ts and files.ts (keep in sync).
-- Services are structured arrays + GIN indexes: orders will be matched to companies by
-- service, mode and governorate later.

create type public.company_activity as enum ('international', 'domestic', 'china', 'other');

create type public.egypt_governorate as enum (
  'cairo', 'giza', 'alexandria', 'qalyubia', 'sharqia', 'dakahlia', 'gharbia', 'monufia',
  'beheira', 'kafr_el_sheikh', 'damietta', 'port_said', 'ismailia', 'suez', 'north_sinai',
  'south_sinai', 'red_sea', 'faiyum', 'beni_suef', 'minya', 'asyut', 'sohag', 'qena', 'luxor',
  'aswan', 'new_valley', 'matrouh'
);

create type public.international_mode as enum ('air', 'sea', 'land');
create type public.international_scope as enum ('shipping', 'customs', 'both');
create type public.service_region as enum (
  'gulf', 'middle_east', 'europe', 'china', 'east_asia', 'north_america', 'africa'
);
create type public.vehicle_type as enum ('pickup', 'box_truck', 'trailer', 'refrigerated', 'other');
create type public.china_site as enum ('shein', 'alibaba', '1688', 'taobao', 'other');
create type public.china_service as enum ('purchasing', 'consolidation', 'shipping_to_egypt');
create type public.company_document_type as enum (
  'commercial_register', 'tax_card', 'customs_license', 'logo'
);

-- ── companies: profile + legal data, 1:1 with a company profile ─────────────
create table public.companies (
  id                         uuid primary key references public.profiles (id) on delete cascade,
  legal_name                 text not null check (char_length(legal_name) between 2 and 120),
  representative_name        text not null check (char_length(representative_name) between 3 and 80),
  representative_title       text not null check (char_length(representative_title) between 2 and 60),
  whatsapp                   text check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  landline                   text check (landline ~ '^[0-9]{7,12}$'),
  website                    text check (char_length(website) <= 300 and website ~* '^https?://'),
  governorate                public.egypt_governorate not null,
  city                       text not null check (char_length(city) between 2 and 60),
  street                     text not null check (char_length(street) between 5 and 200),
  activities                 public.company_activity[] not null
                             check (cardinality(activities) between 1 and 4),
  other_activity             text check (char_length(other_activity) between 3 and 150),
  years_in_business          smallint check (years_in_business between 0 and 100),
  commercial_register_number text not null check (commercial_register_number ~ '^[0-9]{1,10}$'),
  tax_number                 text not null check (tax_number ~ '^[0-9]{9}$'),
  notes                      text check (char_length(notes) <= 1000),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- names used by the API to map unique violations (decision 1)
  constraint companies_commercial_register_number_key unique (commercial_register_number),
  constraint companies_tax_number_key unique (tax_number),
  constraint companies_other_activity_presence_check
    check ((other_activity is not null) = ('other' = any (activities)))
);

comment on table public.companies is
  'Shipping company profile + legal numbers (MW_002). Written by the backend only.';

create index companies_activities_idx on public.companies using gin (activities);
create index companies_governorate_idx on public.companies (governorate);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ── company_services: Step 2, one row per company (empty arrays when not offered) ──
create table public.company_services (
  company_id                uuid primary key references public.companies (id) on delete cascade,
  -- international shipping & customs
  international_modes       public.international_mode[] not null default '{}',
  international_scope       public.international_scope,
  international_countries   text[] not null default '{}'
                            check (array_to_string(international_countries, ',') ~ '^([A-Z]{2}(,|$))*$'),
  international_regions     public.service_region[] not null default '{}',
  -- domestic land shipping ("All governorates" = the flag, with an empty list)
  domestic_all_governorates boolean not null default false,
  domestic_governorates     public.egypt_governorate[] not null default '{}',
  vehicle_types             public.vehicle_type[] not null default '{}',
  vehicle_type_other        text check (char_length(vehicle_type_other) between 3 and 100),
  fleet_size                integer check (fleet_size between 0 and 10000),
  -- shipping from Chinese sites
  china_sites               public.china_site[] not null default '{}',
  china_site_other          text check (char_length(china_site_other) between 3 and 100),
  china_services            public.china_service[] not null default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint company_services_international_check
    check ((cardinality(international_modes) = 0) = (international_scope is null)),
  constraint company_services_all_governorates_check
    check (not domestic_all_governorates or cardinality(domestic_governorates) = 0),
  constraint company_services_vehicle_other_presence_check
    check ((vehicle_type_other is not null) = ('other' = any (vehicle_types))),
  constraint company_services_china_check
    check ((cardinality(china_sites) = 0) = (cardinality(china_services) = 0)),
  constraint company_services_china_other_presence_check
    check ((china_site_other is not null) = ('other' = any (china_sites)))
);

comment on table public.company_services is
  'Structured service details per company (Step 2). Queryable for order matching.';

create index company_services_international_modes_idx
  on public.company_services using gin (international_modes);
create index company_services_domestic_governorates_idx
  on public.company_services using gin (domestic_governorates);
create index company_services_vehicle_types_idx
  on public.company_services using gin (vehicle_types);
create index company_services_china_sites_idx
  on public.company_services using gin (china_sites);

create trigger company_services_set_updated_at
before update on public.company_services
for each row execute function public.set_updated_at();

-- ── company_documents: metadata of the uploaded files (files live in Storage) ──
create table public.company_documents (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  type           public.company_document_type not null,
  storage_bucket text not null check (storage_bucket in ('company-documents', 'company-logos')),
  storage_path   text not null check (char_length(storage_path) <= 200),
  original_name  text not null check (char_length(original_name) between 1 and 255),
  mime_type      text not null
                 check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes     integer not null check (size_bytes between 1 and 5242880),
  uploaded_at    timestamptz not null default now(),
  unique (company_id, type),
  unique (storage_bucket, storage_path),
  constraint company_documents_bucket_check
    check ((type = 'logo') = (storage_bucket = 'company-logos'))
);

comment on table public.company_documents is
  'Company documents metadata. Files are private; admins get short-lived signed URLs.';

-- ── RLS + privileges ──────────────────────────────────────────────────────
-- The company reads its own rows. No insert/update/delete for clients: the backend
-- (service role) writes everything, and nothing changes after submission (spec A5).
alter table public.companies enable row level security;
alter table public.company_services enable row level security;
alter table public.company_documents enable row level security;

revoke all on table public.companies, public.company_services, public.company_documents
  from anon, authenticated;

create policy "companies: owner can read"
on public.companies for select to authenticated
using ((select auth.uid()) = id);

create policy "company_services: owner can read"
on public.company_services for select to authenticated
using ((select auth.uid()) = company_id);

create policy "company_documents: owner can read"
on public.company_documents for select to authenticated
using ((select auth.uid()) = company_id);

grant select on table public.companies, public.company_services to authenticated;
-- documents: metadata only, never the storage location
grant select (id, company_id, type, original_name, mime_type, size_bytes, uploaded_at)
  on table public.company_documents to authenticated;
