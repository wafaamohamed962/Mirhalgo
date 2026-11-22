import { createHash } from 'node:crypto';
import {
  MAX_REQUEST_ATTEMPTS,
  ORDER_REFERENCE_PATTERN,
  collectAttachments,
  deriveOrderValues,
  type AttachmentSlot,
  type Order,
  type OrderRecord,
  type PlaceRef,
  type ReferenceList,
  type SubmitOrderResult,
} from '@mirhalgo/shared';
import { logEvent } from '../lib/logger.js';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AuthUser } from '../middleware/requireAuth.js';
import { fromRows, toRows, withoutUndefined, type StoredOrderRows } from './orderRows.js';
import { listReference } from './reference.js';

/*
 * POST /api/orders + GET /api/orders/:reference (MW_003 B4, spec B7):
 * 1. the body was validated with the shared schema (every conditional rule, strict paths);
 * 2. reference ids are checked against the reference tables (and the DB has foreign keys);
 * 3. CBM / volumetric weight / totals are computed here, never taken from the client;
 * 4. submit_order() does the rest in ONE transaction (balance, rows, files, ledger, status,
 *    draft), idempotent per (customer, Idempotency-Key).
 */

const invalid = () => new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');
const notFound = () => new HttpError(404, 'NOT_FOUND', 'Not found');

// ── reference checks ─────────────────────────────────────────────────────────

type Place = { id?: string; code?: string; countryCode?: string };

async function references() {
  const load = async (list: ReferenceList) =>
    new Map(
      ((await listReference(list)) as Place[]).map(
        (item) => [item.id ?? item.code!, item] as const,
      ),
    );
  const [countries, regions, cities, ports, airports, containerTypes, truckTypes, shippingLines] =
    await Promise.all(
      (
        [
          'countries',
          'regions',
          'cities',
          'ports',
          'airports',
          'container-types',
          'truck-types',
          'shipping-lines',
        ] as const
      ).map(load),
    );
  return { countries, regions, cities, ports, airports, containerTypes, truckTypes, shippingLines };
}

/** Throws 400 unless every list id exists and places belong to the chosen country. */
export async function assertOrderReferences(order: Order): Promise<void> {
  const ref = await references();
  const ok = (condition: boolean) => {
    if (!condition) throw invalid();
  };
  const inCountry = (map: Map<string, Place>, place: PlaceRef | undefined, country: string) => {
    if (place && 'id' in place) ok(map.get(place.id)?.countryCode === country);
  };
  const country = (code: string) => ok(ref.countries.has(code));

  if (order.service === 'china') {
    const d = order.delivery;
    const countryId = 'id' in d.country ? d.country.id : null; // "Other" country: nothing to check
    if (countryId) {
      const deliveryCountries = await listReference('countries', { scope: 'china_delivery' });
      ok(deliveryCountries.some((c) => c.code === countryId));
      inCountry(ref.cities, d.city, countryId);
    }
    return;
  }

  const cargo = order.shipment.cargo;
  if (cargo.kind === 'containers') {
    for (const g of cargo.groups) {
      ok(ref.containerTypes.has(g.containerType));
      if (g.shippingLine && 'id' in g.shippingLine) ok(ref.shippingLines.has(g.shippingLine.id));
    }
  }
  if (cargo.kind === 'trucks') for (const g of cargo.groups) ok(ref.truckTypes.has(g.truckType));

  if (order.service === 'domestic') {
    const s = order.shipment;
    ok(ref.regions.get(s.loadingRegion)?.countryCode === 'EG');
    if (s.landType === 'general') ok(ref.regions.get(s.unloadingRegion)?.countryCode === 'EG');
    else ok(ref.ports.get(s.dischargePort)?.countryCode === 'EG');
    return;
  }

  const s = order.shipment;
  country(s.origin.country);
  country(s.destination.country);
  if (s.mode === 'sea') {
    inCountry(ref.ports, s.origin.port, s.origin.country);
    inCountry(ref.ports, s.destination.port, s.destination.country);
  } else if (s.mode === 'air') {
    if (!('any' in s.origin.airport)) inCountry(ref.airports, s.origin.airport, s.origin.country);
    inCountry(ref.airports, s.destination.airport, s.destination.country);
  } else {
    inCountry(ref.cities, s.origin.city, s.origin.country);
    inCountry(ref.cities, s.destination.city, s.destination.country);
  }
}

// ── submit ───────────────────────────────────────────────────────────────────

/** JSON with sorted keys: the same order always gives the same hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

const RPC_ERRORS: Record<string, () => HttpError> = {
  NO_BALANCE: () => new HttpError(409, 'NO_BALANCE', 'No requests left'),
  IDEMPOTENCY_KEY_REUSED: () =>
    new HttpError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key used for another order'),
  INVALID_ATTACHMENT: invalid,
};

function mapRpcError(error: { code?: string; message?: string }): Error {
  const known = RPC_ERRORS[error.message ?? ''];
  if (known) return known();
  // foreign key / check violations: a reference or value the checks above did not catch
  if (error.code === '23503' || error.code === '23514') return invalid();
  return Object.assign(new Error(error.message), error);
}

export async function submitOrder(
  user: AuthUser,
  order: Order,
  idempotencyKey: string,
  ip?: string,
): Promise<{ status: 200 | 201; result: SubmitOrderResult }> {
  await assertOrderReferences(order);
  const { p_order, p_attachments } = toRows(
    order,
    deriveOrderValues(order),
    collectAttachments(order),
  );
  const { data, error } = await db
    .rpc('submit_order', {
      p_customer_id: user.id,
      p_order,
      p_attachments,
      p_idempotency_key: idempotencyKey,
      p_payload_hash: createHash('sha256').update(canonicalJson(order)).digest('hex'),
    })
    .single();
  if (error) {
    const mapped = mapRpcError(error);
    if (mapped instanceof HttpError && mapped.code === 'NO_BALANCE') {
      logEvent('order_no_balance', ip, { userId: user.id });
    }
    throw mapped;
  }
  if (!data.replayed) {
    logEvent('order_submitted', ip, { userId: user.id, reference: data.reference });
  }
  return {
    status: data.replayed ? 200 : 201,
    result: {
      reference: data.reference,
      balance: { remaining: data.balance_after, total: MAX_REQUEST_ATTEMPTS },
      replayed: data.replayed,
    },
  };
}

// ── read ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

async function rows(query: PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** The customer's own order, rebuilt from the structured rows (never the storage paths). */
export async function getOrder(user: AuthUser, reference: string): Promise<OrderRecord> {
  if (!ORDER_REFERENCE_PATTERN.test(reference)) throw notFound();
  const { data: order, error } = await db
    .from('orders')
    .select('*')
    .eq('customer_id', user.id)
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw notFound();
  const id = order.id as string;
  const byOrder = (
    table:
      | 'order_container_groups'
      | 'order_truck_groups'
      | 'order_cargo_items'
      | 'order_china_products',
  ) => rows(db.from(table).select('*').eq('order_id', id).order('position'));

  const [shipment, containerGroups, truckGroups, cargoItems, china, products, uploads] =
    await Promise.all([
      db.from('order_shipments').select('*').eq('order_id', id).maybeSingle(),
      byOrder('order_container_groups'),
      byOrder('order_truck_groups'),
      byOrder('order_cargo_items'),
      db.from('order_china_details').select('*').eq('order_id', id).maybeSingle(),
      byOrder('order_china_products'),
      rows(
        db
          .from('order_uploads')
          .select('id, slot, cargo_item_id, original_name, mime_type, size_bytes')
          .eq('order_id', id)
          .order('created_at'),
      ),
    ]);
  if (shipment.error) throw shipment.error;
  if (china.error) throw china.error;
  const variants = products.length
    ? await rows(
        db
          .from('order_china_product_variants')
          .select('*')
          .in(
            'product_id',
            products.map((p) => p.id),
          ),
      )
    : [];
  const itemPosition = new Map(cargoItems.map((i) => [i.id, Number(i.position)]));

  const stored: StoredOrderRows = {
    order,
    shipment: shipment.data,
    containerGroups,
    truckGroups,
    cargoItems,
    china: china.data,
    chinaProducts: products.map((p) => ({
      ...p,
      variants: variants.filter((v) => v.product_id === p.id),
    })),
    attachments: uploads.map((u) => ({
      id: u.id as string,
      slot: u.slot as AttachmentSlot,
      itemPosition: u.cargo_item_id == null ? null : (itemPosition.get(u.cargo_item_id) ?? null),
    })),
  };
  const s = shipment.data;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    reference: order.reference as string,
    service: order.service as OrderRecord['service'],
    status: order.status as string,
    submittedAt: order.submitted_at as string,
    order: withoutUndefined(fromRows(stored)),
    derived: {
      items: cargoItems.map((i) => ({ cbm: Number(i.cbm), volumetricKg: num(i.volumetric_kg) })),
      totalContainers: num(s?.total_containers),
      totalTrucks: num(s?.total_trucks),
      totalCbm: num(s?.total_cbm),
    },
    attachments: uploads.map((u) => ({
      id: u.id as string,
      slot: u.slot as AttachmentSlot,
      name: u.original_name as string,
      mime: u.mime_type as string,
      size: Number(u.size_bytes),
    })),
  };
}
