-- MW_003 B2 · request balance + append-only ledger (spec B7 "Request balance", B9 RLS).
--
-- customer_balances: the current balance per customer (never below 0).
-- balance_ledger:    every change, append-only: type, order, before → after, reason, actor,
--                    time and a unique key (idempotency: the same grant / consumption can
--                    never be applied twice). Designed for the later admin plan too
--                    (restore / reset with actor_type 'admin').
-- Only SECURITY DEFINER functions (service_role) change them: grant_balance() here,
-- submit_order() in B4 (consume). Customers read their own rows; nobody writes from a client.

create type public.balance_entry_type as enum ('grant', 'consume', 'restore', 'reset');
create type public.balance_actor_type as enum ('system', 'customer', 'admin');

create table public.customer_balances (
  customer_id uuid primary key references public.profiles (id) on delete cascade,
  balance     integer not null check (balance >= 0),
  updated_at  timestamptz not null default now()
);

comment on table public.customer_balances is
  'Request balance per customer (MW_003). Changed only by grant_balance() / submit_order().';

create table public.balance_ledger (
  id         bigint generated always as identity primary key,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  type       public.balance_entry_type not null,
  order_id   uuid, -- foreign key added with the orders table (B4)
  before     integer not null check (before >= 0),
  after      integer not null check (after >= 0),
  -- i18n-ready reason id (portal.balance.reasons.<reason>), e.g. initial_grant
  reason     text not null check (reason ~ '^[a-z][a-z0-9_]{1,63}$'),
  actor_type public.balance_actor_type not null,
  actor_id   uuid,
  unique_key text not null check (char_length(unique_key) between 3 and 200),
  created_at timestamptz not null default now(),
  constraint balance_ledger_unique_key unique (unique_key),
  constraint balance_ledger_direction_check check (
    case type
      when 'consume' then after = before - 1 and order_id is not null
      when 'grant' then after > before
      when 'restore' then after > before
      else true -- reset: any value (admin plan)
    end
  )
);

comment on table public.balance_ledger is
  'Append-only history of every balance change (MW_003). One row per change; never updated.';

create index balance_ledger_customer_idx on public.balance_ledger (customer_id, created_at desc);

-- Append-only: no UPDATE, no DELETE, for every role. The only exception is the cascade when a
-- whole account is deleted (privacy request / unverified cleanup): that runs inside the
-- foreign key's own trigger, so pg_trigger_depth() > 1.
create function public.balance_ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'balance_ledger is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger balance_ledger_append_only
before update or delete on public.balance_ledger
for each row execute function public.balance_ledger_append_only();

-- ── grant_balance(): add requests, idempotent by unique key ─────────────────
create function public.grant_balance(
  p_customer_id uuid,
  p_amount      integer,
  p_reason      text,
  p_unique_key  text,
  p_actor_type  public.balance_actor_type default 'system',
  p_actor_id    uuid default null
)
returns integer -- the balance after the call
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'grant amount must be positive' using errcode = 'check_violation';
  end if;
  if (select role from public.profiles where id = p_customer_id) is distinct from 'customer' then
    raise exception 'only customers have a request balance' using errcode = 'check_violation';
  end if;

  insert into public.customer_balances (customer_id, balance)
  values (p_customer_id, 0)
  on conflict (customer_id) do nothing;

  -- lock first, then check the key: two concurrent calls with the same key apply once
  select balance into v_before
  from public.customer_balances
  where customer_id = p_customer_id
  for update;

  if exists (select 1 from public.balance_ledger where unique_key = p_unique_key) then
    return v_before;
  end if;

  insert into public.balance_ledger (
    customer_id, type, before, after, reason, actor_type, actor_id, unique_key
  )
  values (
    p_customer_id, 'grant', v_before, v_before + p_amount, p_reason, p_actor_type, p_actor_id,
    p_unique_key
  );

  update public.customer_balances
  set balance = v_before + p_amount, updated_at = now()
  where customer_id = p_customer_id;

  return v_before + p_amount;
end;
$$;

revoke execute on function public.grant_balance(uuid, integer, text, text, public.balance_actor_type, uuid)
  from public, anon, authenticated;
grant execute on function public.grant_balance(uuid, integer, text, text, public.balance_actor_type, uuid)
  to service_role;
revoke execute on function public.balance_ledger_append_only() from public, anon, authenticated;

-- ── RLS: customers read their own rows; no client writes ────────────────────
alter table public.customer_balances enable row level security;
alter table public.balance_ledger enable row level security;

revoke all on table public.customer_balances, public.balance_ledger from anon, authenticated;

create policy "customer_balances: owner can read"
on public.customer_balances for select to authenticated
using ((select auth.uid()) = customer_id);

create policy "balance_ledger: owner can read"
on public.balance_ledger for select to authenticated
using ((select auth.uid()) = customer_id);

grant select on table public.customer_balances to authenticated;
-- the customer sees the history, not who (which admin) changed it or the idempotency key
grant select (id, customer_id, type, order_id, before, after, reason, created_at)
  on table public.balance_ledger to authenticated;

-- ── backfill: every verified customer starts with 5 (plan §5 item 15) ───────
-- Same key as the grant at email verification, so nobody ever gets the initial 5 twice.
do $$
declare
  r record;
begin
  for r in
    select id from public.profiles where role = 'customer' and email_verified_at is not null
  loop
    perform public.grant_balance(r.id, 5, 'initial_backfill', 'initial:' || r.id, 'system', null);
  end loop;
end;
$$;
