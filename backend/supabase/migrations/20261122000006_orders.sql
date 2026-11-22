-- MW_003 B4 · orders (spec B7 "POST /api/orders", B8 "Data to store", B9).
--
-- Structured, queryable storage of every submitted field. JSON is not used for the order:
-- every value has its own column or row (later plans match orders to companies by service,
-- mode, route and cargo). Reference values are stored as the list id + a separate "other" text.
--
-- orders                         common part: reference, customer, service, status, contact,
--                                client type, notes, accuracy time, form version, idempotency
-- order_shipments                international / domestic details (1:1)
-- order_container_groups         FCL / land container groups (repeatable)
-- order_truck_groups             FTL truck groups (repeatable)
-- order_cargo_items              LCL / air products (repeatable, CBM + volumetric stored)
-- order_china_details            SHEIN / Chinese sites order + delivery (1:1)
-- order_china_products(+variants) products with colours / sizes {value, quantity}
-- order_status_history           status, time, actor, note
-- order_uploads (B3)             + order link, slot, product link (MSDS per product)
-- submit_order()                 ONE transaction: balance check, order rows, attachments,
--                                ledger consumption (unique per order), status, draft removal.
--                                Idempotent per (customer, Idempotency-Key).

-- ── enums (ids = shared/src/orders.ts; keep in sync) ────────────────────────
create type public.order_status as enum (
  'under_review', 'awaiting_offers', 'offers_received', 'awaiting_approval', 'in_progress',
  'completed', 'cancelled', 'rejected'
);
create type public.order_actor_type as enum ('system', 'customer', 'company', 'admin');
create type public.client_type as enum ('individual', 'company', 'factory', 'trader', 'other');
create type public.operation_type as enum ('export', 'import', 'domestic');
create type public.service_scope as enum ('shipping', 'customs', 'shipping_customs');
create type public.shipping_mode as enum ('sea', 'air', 'land');
create type public.sea_type as enum ('fcl', 'lcl');
create type public.land_type as enum ('container', 'general');
create type public.load_type as enum ('ftl', 'ltl');
create type public.air_service as enum ('airport_airport', 'door_airport', 'airport_door', 'door_door');
create type public.route_side as enum ('origin', 'destination', 'both');
create type public.weight_unit as enum ('kg', 'ton');
create type public.currency_code as enum ('USD', 'EUR', 'EGP');
create type public.input_method as enum ('manual', 'packing_list');
create type public.cargo_kind as enum ('containers', 'trucks', 'ltl', 'loose');
create type public.packaging_type as enum (
  'pallets', 'wooden_crates', 'cartons', 'jumbo_bags', 'drums', 'bulk', 'other'
);
create type public.available_document as enum ('import_export_card', 'commercial_register', 'tax_card');
create type public.execution_documents as enum ('client', 'shipping_company');
create type public.incoterm as enum ('EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP');
create type public.china_source as enum ('shein', 'chinese_sites');
create type public.shein_site as enum ('shein_sa', 'shein_ae');
create type public.chinese_site as enum ('alibaba', 'taobao', '1688', 'other');
create type public.add_method as enum ('cart_link', 'manual', 'screenshots');
create type public.attachment_slot as enum (
  'cargo_packing_list', 'msds', 'item_msds', 'commercial_invoice', 'packing_list', 'draft_bl',
  'other_document', 'screenshot'
);

-- ── orders ──────────────────────────────────────────────────────────────────
create sequence public.order_reference_seq start 1001;

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique
                        default ('MG' || nextval('public.order_reference_seq'))
                        check (reference ~ '^MG[0-9]{4,}$'),
  customer_id           uuid not null references public.profiles (id) on delete cascade,
  service               public.service_type not null,
  status                public.order_status not null default 'under_review',
  contact_name          text not null check (char_length(contact_name) between 3 and 80),
  contact_phone         text not null check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  contact_whatsapp      text not null check (contact_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  client_type           public.client_type not null,
  business_name         text check (char_length(business_name) between 2 and 120),
  notes                 text check (char_length(notes) between 1 and 1000),
  accuracy_confirmed_at timestamptz not null,
  form_version          text not null check (form_version ~ '^[a-z0-9_.@-]{1,40}$'),
  idempotency_key       uuid not null,
  payload_hash          text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  submitted_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint orders_customer_idempotency_key unique (customer_id, idempotency_key),
  constraint orders_business_name_presence_check
    check ((business_name is not null) = (client_type in ('company', 'factory', 'other')))
);

comment on table public.orders is 'Submitted New Request orders (MW_003). Written only by submit_order().';

create index orders_customer_idx on public.orders (customer_id, submitted_at desc);
create index orders_service_status_idx on public.orders (service, status);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ── international / domestic details ────────────────────────────────────────
-- Domestic: origin/destination region = loading/unloading governorate, destination port =
-- port of discharge. Air: origin/destination address = pickup/delivery address.
create table public.order_shipments (
  order_id                     uuid primary key references public.orders (id) on delete cascade,
  operation_type               public.operation_type not null,
  service_scope                public.service_scope not null,
  mode                         public.shipping_mode not null,
  sea_type                     public.sea_type,
  land_type                    public.land_type,
  load_type                    public.load_type,
  air_service                  public.air_service,
  origin_country               char(2) references public.countries (code),
  origin_port_id               text references public.ports (id),
  origin_airport_id            char(3) references public.airports (id),
  origin_airport_any           boolean not null default false,
  origin_city_id               text references public.cities (id),
  origin_region_id             text references public.regions (id),
  origin_place_other           text check (char_length(origin_place_other) between 3 and 100),
  origin_address               text check (char_length(origin_address) between 5 and 300),
  destination_country          char(2) references public.countries (code),
  destination_port_id          text references public.ports (id),
  destination_airport_id       char(3) references public.airports (id),
  destination_city_id          text references public.cities (id),
  destination_region_id        text references public.regions (id),
  destination_place_other      text check (char_length(destination_place_other) between 3 and 100),
  destination_address          text check (char_length(destination_address) between 5 and 300),
  clearance_location           public.route_side,
  clearance_point              text check (char_length(clearance_point) between 3 and 100),
  trucking_side                public.route_side,
  trucking_origin_address      text check (char_length(trucking_origin_address) between 5 and 300),
  trucking_destination_address text check (char_length(trucking_destination_address) between 5 and 300),
  ready_date                   date not null,
  cargo_value                  numeric(14, 2) check (cargo_value >= 0),
  cargo_value_currency         public.currency_code,
  incoterm                     public.incoterm,
  available_documents          public.available_document[] not null default '{}',
  execution_documents          public.execution_documents,
  insurance                    boolean not null default false,
  warehousing                  boolean not null default false,
  cargo_kind                   public.cargo_kind not null,
  cargo_description            text check (char_length(cargo_description) between 3 and 500),
  cargo_input_method           public.input_method,
  hazardous                    boolean not null default false,
  packaging_type               public.packaging_type,
  packaging_other              text check (char_length(packaging_other) between 3 and 100),
  ltl_total_weight             numeric(12, 3) check (ltl_total_weight > 0),
  ltl_weight_unit              public.weight_unit,
  ltl_pieces                   integer check (ltl_pieces > 0),
  ltl_volume_cbm               numeric(12, 3) check (ltl_volume_cbm > 0),
  ltl_length_cm                numeric(6, 1) check (ltl_length_cm > 0),
  ltl_width_cm                 numeric(6, 1) check (ltl_width_cm > 0),
  ltl_height_cm                numeric(6, 1) check (ltl_height_cm > 0),
  total_containers             integer check (total_containers > 0),
  total_trucks                 integer check (total_trucks > 0),
  total_cbm                    numeric(12, 3),
  constraint order_shipments_value_check
    check ((cargo_value is null) = (cargo_value_currency is null)),
  constraint order_shipments_insurance_check check (not insurance or cargo_value is not null)
);

create index order_shipments_route_idx
  on public.order_shipments (mode, origin_country, destination_country);

-- ── repeatable groups ───────────────────────────────────────────────────────
create table public.order_container_groups (
  id                  bigint generated always as identity primary key,
  order_id            uuid not null references public.orders (id) on delete cascade,
  position            smallint not null check (position between 0 and 19),
  container_type_id   text not null references public.container_types (id),
  count               integer not null check (count between 1 and 999),
  description         text not null check (char_length(description) between 3 and 500),
  weight_value        numeric(12, 3) check (weight_value > 0),
  weight_unit         public.weight_unit,
  shipping_line_id    text references public.shipping_lines (id),
  shipping_line_other text check (char_length(shipping_line_other) between 3 and 100),
  target_price        numeric(14, 2) check (target_price >= 0),
  target_currency     public.currency_code,
  unique (order_id, position),
  check ((weight_value is null) = (weight_unit is null)),
  check ((target_price is null) = (target_currency is null)),
  check (shipping_line_id is null or shipping_line_other is null)
);

create table public.order_truck_groups (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id) on delete cascade,
  position      smallint not null check (position between 0 and 19),
  truck_type_id text not null references public.truck_types (id),
  count         integer not null check (count between 1 and 999),
  description   text not null check (char_length(description) between 3 and 500),
  weight_value  numeric(12, 3) check (weight_value > 0),
  weight_unit   public.weight_unit,
  unique (order_id, position),
  check ((weight_value is null) = (weight_unit is null))
);

create table public.order_cargo_items (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id) on delete cascade,
  position      smallint not null check (position between 0 and 49),
  description   text not null check (char_length(description) between 2 and 200),
  weight_value  numeric(12, 3) not null check (weight_value > 0),
  weight_unit   public.weight_unit not null,
  cartons       integer not null check (cartons between 1 and 100000),
  length_cm     numeric(6, 1) not null check (length_cm > 0),
  width_cm      numeric(6, 1) not null check (width_cm > 0),
  height_cm     numeric(6, 1) not null check (height_cm > 0),
  cbm           numeric(12, 3) not null,   -- computed by the API (spec B9)
  volumetric_kg numeric(12, 2),            -- air only, information
  hazardous     boolean not null default false,
  unique (order_id, position)
);

-- ── SHEIN & Chinese sites ───────────────────────────────────────────────────
create table public.order_china_details (
  order_id               uuid primary key references public.orders (id) on delete cascade,
  source                 public.china_source not null,
  shein_site             public.shein_site,
  chinese_site           public.chinese_site,
  chinese_site_other     text check (char_length(chinese_site_other) between 2 and 300),
  add_method             public.add_method not null,
  cart_link              text check (char_length(cart_link) <= 2000 and cart_link ~ '^https://'),
  shipping_method        public.shipping_mode not null,
  supplier_address       text check (char_length(supplier_address) between 5 and 300),
  delivery_country       char(2) references public.countries (code),
  delivery_country_other text check (char_length(delivery_country_other) between 3 and 100),
  delivery_city_id       text references public.cities (id),
  delivery_city_other    text check (char_length(delivery_city_other) between 3 and 100),
  delivery_address       text not null check (char_length(delivery_address) between 5 and 300),
  receiver_name          text not null check (char_length(receiver_name) between 3 and 80),
  receiver_phone         text not null check (receiver_phone ~ '^\+[1-9][0-9]{7,14}$'),
  check ((delivery_country is null) <> (delivery_country_other is null)),
  check ((delivery_city_id is null) <> (delivery_city_other is null))
);

create table public.order_china_products (
  id       bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  url      text check (char_length(url) <= 2000 and url ~* '^https?://'),
  name     text check (char_length(name) between 2 and 200),
  quantity integer not null check (quantity between 1 and 10000),
  notes    text check (char_length(notes) between 1 and 500),
  unique (order_id, position),
  check (url is not null or name is not null)
);

create table public.order_china_product_variants (
  id         bigint generated always as identity primary key,
  product_id bigint not null references public.order_china_products (id) on delete cascade,
  kind       text not null check (kind in ('color', 'size')),
  position   smallint not null check (position between 0 and 29),
  value      text not null check (char_length(value) between 1 and 40),
  quantity   integer not null check (quantity between 1 and 10000),
  unique (product_id, kind, position)
);

-- ── status history ──────────────────────────────────────────────────────────
create table public.order_status_history (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  actor_type public.order_actor_type not null,
  actor_id   uuid,
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ── links added now that orders exist ───────────────────────────────────────
alter table public.order_uploads
  add column slot public.attachment_slot,
  add column cargo_item_id bigint references public.order_cargo_items (id) on delete set null,
  add constraint order_uploads_order_fkey
    foreign key (order_id) references public.orders (id) on delete cascade,
  add constraint order_uploads_slot_check check ((order_id is null) = (slot is null));
create index order_uploads_order_idx on public.order_uploads (order_id);

alter table public.balance_ledger
  add constraint balance_ledger_order_fkey
    foreign key (order_id) references public.orders (id) on delete cascade;

-- ── RLS: the customer reads its own orders; companies have no access (B9) ───
do $$
declare
  t text;
begin
  foreach t in array array['orders', 'order_shipments', 'order_container_groups',
                           'order_truck_groups', 'order_cargo_items', 'order_china_details',
                           'order_china_products', 'order_china_product_variants',
                           'order_status_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end;
$$;

create policy "orders: owner can read" on public.orders for select to authenticated
using ((select auth.uid()) = customer_id);

do $$
declare
  t text;
begin
  foreach t in array array['order_shipments', 'order_container_groups', 'order_truck_groups',
                           'order_cargo_items', 'order_china_details', 'order_china_products',
                           'order_status_history'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (
         select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())))',
      t || ': owner can read', t);
  end loop;
end;
$$;

create policy "order_china_product_variants: owner can read"
on public.order_china_product_variants for select to authenticated
using (exists (
  select 1 from public.order_china_products p join public.orders o on o.id = p.order_id
  where p.id = product_id and o.customer_id = (select auth.uid())
));

-- the customer never reads the idempotency key or the payload hash
grant select (id, reference, customer_id, service, status, contact_name, contact_phone,
              contact_whatsapp, client_type, business_name, notes, accuracy_confirmed_at,
              form_version, submitted_at, updated_at)
  on table public.orders to authenticated;
grant select on table public.order_shipments, public.order_container_groups,
  public.order_truck_groups, public.order_cargo_items, public.order_china_details,
  public.order_china_products, public.order_china_product_variants
  to authenticated;
grant select (id, order_id, status, created_at) on table public.order_status_history to authenticated;
-- the customer may see the slot of its attachments too
grant select (slot, cargo_item_id) on table public.order_uploads to authenticated;

-- ── submit_order(): everything in ONE transaction ───────────────────────────
create function public.submit_order(
  p_customer_id     uuid,
  p_order           jsonb, -- {order, shipment?, container_groups, truck_groups, cargo_items, china?, china_products}
  p_attachments     jsonb, -- [{upload_id, slot, item_position?}]
  p_idempotency_key uuid,
  p_payload_hash    text
)
returns table (order_id uuid, reference text, balance_after integer, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_before   integer;
  v_existing record;
  v_order    uuid;
  v_ref      text;
  v_product  jsonb;
  v_pid      bigint;
  v_service  public.service_type := (p_order -> 'order' ->> 'service')::public.service_type;
  v_files    integer := jsonb_array_length(coalesce(p_attachments, '[]'));
begin
  if (select role from public.profiles where id = p_customer_id) is distinct from 'customer' then
    raise exception 'only customers can submit orders' using errcode = 'check_violation';
  end if;

  -- 1. lock the balance first: concurrent submits of this customer wait here, so a retry with
  --    the same key finds the first order and two tabs can never both spend the last request
  select balance into v_before
  from public.customer_balances
  where customer_id = p_customer_id
  for update;

  select o.id, o.reference, o.payload_hash into v_existing
  from public.orders o
  where o.customer_id = p_customer_id and o.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return query
      select v_existing.id, v_existing.reference,
             (select l.after from public.balance_ledger l where l.unique_key = 'order:' || v_existing.id),
             true;
    return;
  end if;

  if coalesce(v_before, 0) <= 0 then
    raise exception 'NO_BALANCE' using errcode = 'P0001';
  end if;

  -- 2. the order and its rows
  insert into public.orders (
    customer_id, service, contact_name, contact_phone, contact_whatsapp, client_type,
    business_name, notes, accuracy_confirmed_at, form_version, idempotency_key, payload_hash
  )
  select p_customer_id, r.service, r.contact_name, r.contact_phone, r.contact_whatsapp,
         r.client_type, r.business_name, r.notes, now(), r.form_version, p_idempotency_key,
         p_payload_hash
  from jsonb_populate_record(null::public.orders, p_order -> 'order') r
  returning id, reference into v_order, v_ref;

  if jsonb_typeof(p_order -> 'shipment') = 'object' then
    insert into public.order_shipments
    select (jsonb_populate_record(null::public.order_shipments,
              (p_order -> 'shipment') || jsonb_build_object('order_id', v_order))).*;
  end if;

  insert into public.order_container_groups (
    order_id, position, container_type_id, count, description, weight_value, weight_unit,
    shipping_line_id, shipping_line_other, target_price, target_currency
  )
  select v_order, g.position, g.container_type_id, g.count, g.description, g.weight_value,
         g.weight_unit, g.shipping_line_id, g.shipping_line_other, g.target_price, g.target_currency
  from jsonb_populate_recordset(null::public.order_container_groups,
                                coalesce(p_order -> 'container_groups', '[]')) g;

  insert into public.order_truck_groups (
    order_id, position, truck_type_id, count, description, weight_value, weight_unit
  )
  select v_order, g.position, g.truck_type_id, g.count, g.description, g.weight_value, g.weight_unit
  from jsonb_populate_recordset(null::public.order_truck_groups,
                                coalesce(p_order -> 'truck_groups', '[]')) g;

  insert into public.order_cargo_items (
    order_id, position, description, weight_value, weight_unit, cartons, length_cm, width_cm,
    height_cm, cbm, volumetric_kg, hazardous
  )
  select v_order, i.position, i.description, i.weight_value, i.weight_unit, i.cartons,
         i.length_cm, i.width_cm, i.height_cm, i.cbm, i.volumetric_kg, i.hazardous
  from jsonb_populate_recordset(null::public.order_cargo_items,
                                coalesce(p_order -> 'cargo_items', '[]')) i;

  if jsonb_typeof(p_order -> 'china') = 'object' then
    insert into public.order_china_details
    select (jsonb_populate_record(null::public.order_china_details,
              (p_order -> 'china') || jsonb_build_object('order_id', v_order))).*;
  end if;

  for v_product in select * from jsonb_array_elements(coalesce(p_order -> 'china_products', '[]'))
  loop
    insert into public.order_china_products (order_id, position, url, name, quantity, notes)
    select v_order, p.position, p.url, p.name, p.quantity, p.notes
    from jsonb_populate_record(null::public.order_china_products, v_product) p
    returning id into v_pid;

    insert into public.order_china_product_variants (product_id, kind, position, value, quantity)
    select v_pid, v.kind, v.position, v.value, v.quantity
    from jsonb_populate_recordset(null::public.order_china_product_variants,
                                  coalesce(v_product -> 'variants', '[]')) v;
  end loop;

  -- 3. attachments: this customer's, not in another order, the expected purpose per slot
  if v_files > 20
     or (select count(distinct a.upload_id) from jsonb_to_recordset(coalesce(p_attachments, '[]'))
           as a (upload_id uuid)) <> v_files
     or exists (
       select 1
       from jsonb_to_recordset(coalesce(p_attachments, '[]'))
         as a (upload_id uuid, slot public.attachment_slot, item_position integer)
       left join public.order_uploads u on u.id = a.upload_id
       where u.id is null
          or u.customer_id <> p_customer_id
          or u.order_id is not null
          or u.purpose::text <> case a.slot
               when 'cargo_packing_list' then 'packing_list'
               when 'packing_list' then 'packing_list'
               when 'msds' then 'msds'
               when 'item_msds' then 'msds'
               when 'commercial_invoice' then 'invoice'
               when 'screenshot' then 'screenshot'
               else 'document'
             end
          or (a.slot = 'item_msds') <> (a.item_position is not null)
     ) then
    raise exception 'INVALID_ATTACHMENT' using errcode = 'P0001';
  end if;

  update public.order_uploads u
  set order_id = v_order,
      slot = a.slot,
      draft_id = null,
      cargo_item_id = (select ci.id from public.order_cargo_items ci
                       where ci.order_id = v_order and ci.position = a.item_position)
  from jsonb_to_recordset(coalesce(p_attachments, '[]'))
    as a (upload_id uuid, slot public.attachment_slot, item_position integer)
  where u.id = a.upload_id;

  -- 4. one request consumed, once per order (unique key)
  insert into public.balance_ledger (
    customer_id, type, order_id, before, after, reason, actor_type, actor_id, unique_key
  )
  values (
    p_customer_id, 'consume', v_order, v_before, v_before - 1, 'order_submitted', 'customer',
    p_customer_id, 'order:' || v_order
  );
  update public.customer_balances
  set balance = v_before - 1, updated_at = now()
  where customer_id = p_customer_id;

  -- 5. first status, and the draft of this service is done
  insert into public.order_status_history (order_id, status, actor_type, actor_id)
  values (v_order, 'under_review', 'customer', p_customer_id);
  delete from public.order_drafts d where d.customer_id = p_customer_id and d.service = v_service;

  return query select v_order, v_ref, v_before - 1, false;
end;
$$;

revoke execute on function public.submit_order(uuid, jsonb, jsonb, uuid, text)
  from public, anon, authenticated;
grant execute on function public.submit_order(uuid, jsonb, jsonb, uuid, text) to service_role;
