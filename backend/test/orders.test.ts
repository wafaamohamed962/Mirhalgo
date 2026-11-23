import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* POST /api/orders + GET /api/orders/:reference (MW_003 B4). Supabase and the lists are mocked. */

const rpc = vi.fn();
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const tableRows: Record<string, unknown> = {};

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    auth: {
      getUser: async (token: string) =>
        token.startsWith('customer-')
          ? {
              data: { user: { id: token, email: 'c@x.com', app_metadata: { role: 'customer' } } },
              error: null,
            }
          : { data: { user: null }, error: new Error('invalid') },
    },
    rpc: (name: string, args: unknown) => {
      rpc(name, args);
      return { single: async () => rpcResult };
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const result = () => {
        const value = tableRows[table];
        if (table === 'orders') {
          const order = value as Record<string, unknown> | undefined;
          return order &&
            order.reference === filters.reference &&
            order.customer_id === filters.customer_id
            ? order
            : null;
        }
        return value ?? null;
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, v: unknown) => ((filters[column] = v), builder),
        in: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: result(), error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: result() ?? [], error: null }).then(resolve),
      };
      return builder;
    },
  },
}));

const LISTS: Record<string, unknown[]> = {
  countries: [
    { code: 'EG', chinaDelivery: true },
    { code: 'CN', chinaDelivery: false },
  ],
  ports: [
    { id: 'EG-ALEXANDRIA', countryCode: 'EG' },
    { id: 'CN-SHANGHAI', countryCode: 'CN' },
  ],
  'container-types': [{ id: '40_high_cube' }],
  regions: [],
  cities: [],
  airports: [],
  'truck-types': [],
  'shipping-lines': [{ id: 'maersk' }],
};
vi.mock('../src/services/reference.js', () => ({
  listReference: async (list: string, query: { scope?: string } = {}) =>
    list === 'countries' && query.scope === 'china_delivery'
      ? LISTS.countries!.filter((c) => (c as { chinaDelivery: boolean }).chinaDelivery)
      : (LISTS[list] ?? []),
}));
vi.spyOn(console, 'log').mockImplementation(() => {});

const { createApp } = await import('../src/app.js');
const { cairoToday } = await import('@mirhalgo/shared');
const app = createApp();

const tomorrow = (() => {
  const d = new Date(`${cairoToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const MSDS = '00000000-0000-4000-8000-000000000001';
const order = () => ({
  service: 'international',
  formVersion: 'international@1',
  contact: {
    fullName: 'Wafaa Mohamed',
    phone: '+201012345678',
    whatsappSameAsPhone: true,
    clientType: 'individual',
  },
  operation: { operationType: 'import', serviceScope: 'shipping' },
  shipment: {
    mode: 'sea',
    seaType: 'fcl',
    origin: { country: 'CN', port: { id: 'CN-SHANGHAI' } },
    destination: { country: 'EG', port: { id: 'EG-ALEXANDRIA' } },
    cargo: {
      kind: 'containers',
      groups: [
        {
          containerType: '40_high_cube',
          count: '٢',
          description: 'Tiles',
          shippingLine: { id: 'maersk' },
        },
        { containerType: '40_high_cube', count: 3, description: 'Glass' },
      ],
      hazardous: true,
      msdsUploadId: MSDS,
    },
  },
  services: { executionDocuments: 'client' },
  readyDate: tomorrow,
  confirmAccuracy: true,
});

let ipN = 0;
/** One customer per test: the 10 / hour limit is per user. */
let customer = 'customer-0';
const submit = (body: unknown, key: string | null = randomUUID(), token = customer) => {
  const req = request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Forwarded-For', `10.2.0.${++ipN}`);
  return (key ? req.set('Idempotency-Key', key) : req).send(body as object);
};

beforeEach(() => {
  customer = `customer-${++ipN}`;
  rpc.mockClear();
  rpcResult = {
    data: { order_id: 'o-1', reference: 'MG1001', balance_after: 4, replayed: false },
    error: null,
  };
  for (const key of Object.keys(tableRows)) delete tableRows[key];
});

describe('POST /api/orders', () => {
  it('401 without a session; 400 without a UUID Idempotency-Key', async () => {
    expect((await submit(order(), randomUUID(), 'bad')).status).toBe(401);
    expect((await submit(order(), null)).body.error.code).toBe('VALIDATION_ERROR');
    expect((await submit(order(), 'not-a-uuid')).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('201: one RPC with rows, the computed totals, the attachment slots and a canonical hash', async () => {
    const key = randomUUID();
    const res = await submit(order(), key);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      data: { reference: 'MG1001', balance: { remaining: 4, total: 5 }, replayed: false },
    });
    const [name, args] = rpc.mock.calls[0]!;
    expect(name).toBe('submit_order');
    expect(args).toMatchObject({
      p_customer_id: customer,
      p_idempotency_key: key,
      p_attachments: [{ upload_id: MSDS, slot: 'msds' }],
      p_order: {
        order: {
          service: 'international',
          client_type: 'individual',
          contact_whatsapp: '+201012345678',
        },
        shipment: {
          mode: 'sea',
          sea_type: 'fcl',
          origin_port_id: 'CN-SHANGHAI',
          total_containers: 5,
          hazardous: true,
        },
        container_groups: [
          { position: 0, container_type_id: '40_high_cube', count: 2, shipping_line_id: 'maersk' },
          { position: 1, count: 3 },
        ],
      },
    });
    expect(args.p_payload_hash).toMatch(/^[0-9a-f]{64}$/);

    // the same order with its keys in another order → the same hash (a retry is recognised)
    const reordered = Object.fromEntries(Object.entries(order()).reverse());
    await submit(reordered, key);
    expect(rpc.mock.calls[1]![1].p_payload_hash).toBe(args.p_payload_hash);
  });

  it('a replay of the same key answers 200 with the same reference', async () => {
    rpcResult = {
      data: { order_id: 'o-1', reference: 'MG1001', balance_after: 4, replayed: true },
      error: null,
    };
    const res = await submit(order());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reference: 'MG1001', replayed: true });
  });

  it.each([
    ['NO_BALANCE', { message: 'NO_BALANCE', code: 'P0001' }, 409, 'NO_BALANCE'],
    [
      'a reused key',
      { message: 'IDEMPOTENCY_KEY_REUSED', code: 'P0001' },
      422,
      'IDEMPOTENCY_KEY_REUSED',
    ],
    ['a bad attachment', { message: 'INVALID_ATTACHMENT', code: 'P0001' }, 400, 'VALIDATION_ERROR'],
    ['a foreign key violation', { message: 'fk', code: '23503' }, 400, 'VALIDATION_ERROR'],
  ])('%s → %s', async (_name, error, status, code) => {
    rpcResult = { data: null, error };
    const res = await submit(order());
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('values the client must not send (computed totals, unknown fields) are refused', async () => {
    const withTotals = order();
    (withTotals.shipment.cargo as Record<string, unknown>).totalContainers = 1;
    expect((await submit(withTotals)).status).toBe(400);
    expect((await submit({ ...order(), price: 1 })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reference checks: unknown ids or a port of another country → 400 before the database', async () => {
    const wrongCountry = order();
    wrongCountry.shipment.destination.port = { id: 'CN-SHANGHAI' };
    expect((await submit(wrongCountry)).body.error.code).toBe('VALIDATION_ERROR');
    const unknownType = order();
    unknownType.shipment.cargo.groups[0]!.containerType = 'spaceship';
    expect((await submit(unknownType)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders/:reference', () => {
  it('404 for another customer, an unknown or malformed reference', async () => {
    tableRows.orders = { id: 'o-1', reference: 'MG1001', customer_id: 'someone-else' };
    const get = (ref: string) =>
      request(app).get(`/api/orders/${ref}`).set('Authorization', `Bearer ${customer}`);
    expect((await get('MG1001')).status).toBe(404);
    expect((await get('MG9999')).status).toBe(404);
    expect((await get('drop-table')).status).toBe(404);
  });

  it('rebuilds the order from its rows (+ computed values, attachment metadata)', async () => {
    tableRows.orders = {
      id: 'o-1',
      reference: 'MG1001',
      customer_id: customer,
      service: 'international',
      status: 'under_review',
      submitted_at: '2026-11-23T10:00:00Z',
      contact_name: 'Wafaa Mohamed',
      contact_phone: '+201012345678',
      contact_whatsapp: '+201012345678',
      client_type: 'individual',
      business_name: null,
      notes: null,
      form_version: 'international@1',
    };
    tableRows.order_shipments = {
      operation_type: 'import',
      service_scope: 'shipping',
      mode: 'sea',
      sea_type: 'fcl',
      origin_country: 'CN',
      origin_port_id: 'CN-SHANGHAI',
      destination_country: 'EG',
      destination_port_id: 'EG-ALEXANDRIA',
      ready_date: tomorrow,
      available_documents: [],
      execution_documents: 'client',
      insurance: false,
      warehousing: false,
      cargo_kind: 'containers',
      hazardous: false,
      total_containers: 2,
    };
    tableRows.order_container_groups = [
      { position: 0, container_type_id: '40_high_cube', count: 2, description: 'Tiles' },
    ];
    tableRows.order_uploads = [];
    const res = await request(app)
      .get('/api/orders/MG1001')
      .set('Authorization', `Bearer ${customer}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      reference: 'MG1001',
      status: 'under_review',
      derived: { totalContainers: 2 },
      order: {
        service: 'international',
        shipment: {
          mode: 'sea',
          origin: { country: 'CN', port: { id: 'CN-SHANGHAI' } },
          cargo: {
            kind: 'containers',
            groups: [{ containerType: '40_high_cube', count: 2, description: 'Tiles' }],
          },
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/storage_path|idempotency|payload_hash/);
  });
});

describe('rate limit', () => {
  it('10 submits per hour per user', async () => {
    const ip = '10.3.0.1';
    const send = () =>
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customer}`)
        .set('X-Forwarded-For', ip)
        .set('Idempotency-Key', randomUUID())
        .send(order());
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await send()).status);
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
