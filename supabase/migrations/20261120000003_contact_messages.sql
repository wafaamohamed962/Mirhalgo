-- MW_001 · contact_messages (spec 3.5, section 6). Backend only.

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 2 and 50),
  last_name  text not null check (char_length(last_name) between 2 and 50),
  email      text not null,
  phone      text not null,
  message    text not null check (char_length(message) between 10 and 2000),
  email_sent boolean not null default false,
  ip         inet,
  created_at timestamptz not null default now()
);

comment on table public.contact_messages is 'Copy of every contact-form message. Backend access only.';

create index contact_messages_created_idx on public.contact_messages (created_at desc);

-- ── RLS: enabled, no policies → no access for anon/authenticated ──
alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon, authenticated;
