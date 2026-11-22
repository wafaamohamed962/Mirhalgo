import request from 'supertest';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * MW_003 B3 at the HTTP level: POST/DELETE /api/uploads, GET/PUT/DELETE /api/orders/drafts/:service
 * and the cleanup, over a small in-memory stand-in for Supabase (tables, storage, auth, RPCs).
 */

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { order_uploads: [], order_drafts: [] };
const storage = { files: new Map<string, Buffer>(), failRemove: false };
const rpc = vi.fn();
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
let nextId = 0;
const id = () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`;

/** Minimal PostgREST-like builder over `tables` (the filters the services use). */
function from(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let action: 'select' | 'insert' | 'delete' = 'select';
  let inserted: Row | null = null;
  let countOnly = false;
  const rows = () => (tables[table] ??= []).filter((row) => filters.every((f) => f(row)));
  const run = () => {
    if (action === 'insert') {
      const row = {
        id: id(),
        created_at: new Date().toISOString(),
        draft_id: null,
        order_id: null,
        ...inserted,
      };
      tables[table]!.push(row);
      return { data: [row], error: null };
    }
    if (action === 'delete') {
      const gone = new Set(rows());
      tables[table] = tables[table]!.filter((row) => !gone.has(row));
      return { data: null, error: null };
    }
    return countOnly
      ? { data: null, count: rows().length, error: null }
      : { data: rows(), error: null };
  };
  const builder: Record<string, unknown> = {
    select: (_c?: string, opts?: { count?: string; head?: boolean }) => {
      countOnly = Boolean(opts?.head);
      return builder;
    },
    insert: (row: Row) => {
      action = 'insert';
      inserted = row;
      return builder;
    },
    delete: () => {
      action = 'delete';
      return builder;
    },
    eq: (column: string, value: unknown) => (filters.push((r) => r[column] === value), builder),
    is: (column: string, value: unknown) => (
      filters.push((r) => (r[column] ?? null) === value),
      builder
    ),
    in: (column: string, values: unknown[]) => (
      filters.push((r) => values.includes(r[column])),
      builder
    ),
    order: () => builder,
    single: async () => ({ data: run().data?.[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return builder;
}

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    auth: {
      getUser: async (token: string) =>
        token === 'customer-token'
          ? {
              data: {
                user: { id: 'cus-1', email: 'c@example.com', app_metadata: { role: 'customer' } },
              },
              error: null,
            }
          : { data: { user: null }, error: new Error('invalid') },
    },
    from,
    rpc: (name: string, args: unknown) => {
      rpc(name, args);
      const result = Promise.resolve(rpcResult);
      return Object.assign(result, { single: () => Promise.resolve(rpcResult) });
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, buffer: Buffer) => {
          storage.files.set(`${bucket}/${path}`, buffer);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          if (storage.failRemove) return { error: new Error('storage down') };
          for (const p of paths) storage.files.delete(`${bucket}/${p}`);
          return { error: null };
        },
      }),
    },
  },
}));
vi.mock('../src/services/companies.js', () => ({ cleanupExpiredRegistrations: async () => 0 }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const { createApp } = await import('../src/app.js');
const cleanup = await import('../src/services/cleanup.js');
const app = createApp();
const AUTH = { Authorization: 'Bearer customer-token' };
let ipN = 0;
const upload = (purpose: string, content: Buffer | string, name: string) =>
  request(app)
    .post('/api/uploads')
    .set(AUTH)
    .set('X-Forwarded-For', `10.1.0.${++ipN}`)
    .field('purpose', purpose)
    .attach('file', Buffer.from(content), name);

beforeEach(() => {
  tables.order_uploads = [];
  tables.order_drafts = [];
  storage.files.clear();
  storage.failRemove = false;
  rpc.mockClear();
  rpcResult = { data: null, error: null };
});

describe('POST /api/uploads', () => {
  it('needs a customer session', async () => {
    expect((await request(app).post('/api/uploads')).status).toBe(401);
  });

  it('stores a PDF privately under a random name; never returns the path', async () => {
    const res = await upload('invoice', '%PDF-1.7 test', 'فاتورة.pdf');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      purpose: 'invoice',
      name: 'فاتورة.pdf',
      mime: 'application/pdf',
    });
    expect(res.body.data).not.toHaveProperty('storage_path');
    const [row] = tables.order_uploads;
    expect(row!.storage_path).toMatch(/^cus-1\/[0-9a-f-]{36}\.pdf$/);
    expect(storage.files.has(`order-attachments/${row!.storage_path}`)).toBe(true);
  });

  it('accepts CSV by content; images are re-encoded (metadata dropped)', async () => {
    expect((await upload('packing_list', 'item,qty\nshirt,3\n', 'list.csv')).body.data.mime).toBe(
      'text/csv',
    );
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#2563EB' },
    })
      .png()
      .withExif({ IFD0: { Make: 'SecretCam' } })
      .toBuffer();
    const res = await upload('screenshot', png, 'cart.png');
    expect(res.status).toBe(201);
    const stored = storage.files.get(
      `order-attachments/${tables.order_uploads.at(-1)!.storage_path}`,
    )!;
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
  });

  it.each([
    [
      'an EXE renamed to .pdf',
      'document',
      'MZ\u0090\u0000',
      'invoice.pdf',
      'FILE_TYPE_NOT_ALLOWED',
    ],
    ['a PDF as a screenshot', 'screenshot', '%PDF-1.7', 'shot.pdf', 'FILE_TYPE_NOT_ALLOWED'],
    ['an unknown purpose', 'selfie', '%PDF-1.7', 'a.pdf', 'VALIDATION_ERROR'],
  ])('refuses %s', async (_name, purpose, content, file, code) => {
    const res = await upload(purpose, content, file);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
    expect(tables.order_uploads).toHaveLength(0);
    expect(storage.files.size).toBe(0);
  });

  it('caps pending uploads per customer (60)', async () => {
    for (let i = 0; i < 60; i++) {
      tables.order_uploads.push({ id: id(), customer_id: 'cus-1', order_id: null });
    }
    const res = await upload('document', '%PDF-1.7', 'a.pdf');
    expect(res.body.error.code).toBe('TOO_MANY_FILES');
  });
});

describe('DELETE /api/uploads/:id', () => {
  it('removes an own, not-ordered file; others are 404', async () => {
    const created = (await upload('document', '%PDF-1.7', 'a.pdf')).body.data;
    tables.order_uploads.push({
      id: id(),
      customer_id: 'someone-else',
      order_id: null,
      storage_path: 'x/y.pdf',
    });
    const foreign = tables.order_uploads.at(-1)!.id as string;
    expect((await request(app).delete(`/api/uploads/${foreign}`).set(AUTH)).status).toBe(404);
    expect((await request(app).delete('/api/uploads/not-a-uuid').set(AUTH)).status).toBe(404);
    expect((await request(app).delete(`/api/uploads/${created.id}`).set(AUTH)).status).toBe(200);
    expect(tables.order_uploads.map((r) => r.id)).toEqual([foreign]);
    expect(storage.files.size).toBe(0);
  });
});

describe('/api/orders/drafts/:service', () => {
  it('GET: null when there is none; unknown service is 404', async () => {
    expect((await request(app).get('/api/orders/drafts/china').set(AUTH)).body).toEqual({
      ok: true,
      data: null,
    });
    expect((await request(app).get('/api/orders/drafts/space').set(AUTH)).status).toBe(404);
  });

  it('PUT: the form payload (bigger than the global 10 kB limit) goes to save_order_draft', async () => {
    rpcResult = { data: { draft_id: 'd-1', updated_at: '2026-11-22T12:00:00Z' }, error: null };
    const payload = { notes: 'x'.repeat(30_000) };
    const ids = ['11111111-1111-4111-8111-111111111111'];
    const res = await request(app)
      .put('/api/orders/drafts/international')
      .set(AUTH)
      .send({ payload, formVersion: 'international@1', uploadIds: ids });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updatedAt: '2026-11-22T12:00:00Z' });
    expect(rpc).toHaveBeenCalledWith('save_order_draft', {
      p_customer_id: 'cus-1',
      p_service: 'international',
      p_payload: payload,
      p_form_version: 'international@1',
      p_upload_ids: ids,
    });
  });

  it('PUT: invalid body → 400; a file that is not allowed (SQL check) → 400; > 64 kB → 413', async () => {
    const put = (body: unknown) =>
      request(app)
        .put('/api/orders/drafts/domestic')
        .set(AUTH)
        .send(body as object);
    expect((await put({ payload: [], formVersion: 'v1' })).status).toBe(400);
    expect((await put({ payload: {}, formVersion: 'Bad Version!' })).status).toBe(400);
    rpcResult = { data: null, error: { code: '23514', message: 'invalid upload' } };
    expect(
      (await put({ payload: {}, formVersion: 'domestic@1', uploadIds: [] })).body.error.code,
    ).toBe('VALIDATION_ERROR');
    expect((await put({ payload: { x: 'y'.repeat(70_000) }, formVersion: 'v1' })).status).toBe(413);
  });

  it('GET returns the draft with its files; DELETE removes the draft and its files now', async () => {
    const file = (await upload('msds', '%PDF-1.7', 'msds.pdf')).body.data;
    tables.order_drafts.push({
      id: 'd-1',
      customer_id: 'cus-1',
      service: 'china',
      payload: { step: 2 },
      form_version: 'china@1',
      updated_at: '2026-11-22T12:00:00Z',
    });
    tables.order_uploads[0]!.draft_id = 'd-1';
    const got = (await request(app).get('/api/orders/drafts/china').set(AUTH)).body.data;
    expect(got).toMatchObject({ service: 'china', payload: { step: 2 }, formVersion: 'china@1' });
    expect(got.uploads.map((u: { id: string }) => u.id)).toEqual([file.id]);

    expect((await request(app).delete('/api/orders/drafts/china').set(AUTH)).status).toBe(200);
    expect(tables.order_drafts).toHaveLength(0);
    expect(tables.order_uploads).toHaveLength(0);
    expect(storage.files.size).toBe(0);
    // idempotent
    expect((await request(app).delete('/api/orders/drafts/china').set(AUTH)).status).toBe(200);
  });
});

describe('cleanup', () => {
  it('orphan uploads: files first, then rows; a storage failure keeps the rows for a retry', async () => {
    await upload('document', '%PDF-1.7', 'a.pdf');
    const row = tables.order_uploads[0]!;
    rpcResult = { data: [{ upload_id: row.id, storage_path: row.storage_path }], error: null };

    storage.failRemove = true;
    expect(await cleanup.cleanupOrphanUploads()).toBe(0);
    expect(tables.order_uploads).toHaveLength(1);

    storage.failRemove = false;
    expect(await cleanup.cleanupOrphanUploads()).toBe(1);
    expect(tables.order_uploads).toHaveLength(0);
    expect(storage.files.size).toBe(0);
  });

  it('the scheduled run only works when it gets the lease, and never throws', async () => {
    rpcResult = { data: false, error: null };
    await cleanup.runScheduledCleanup();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['claim_job_lease']);
    rpcResult = { data: null, error: new Error('db down') };
    await expect(cleanup.runScheduledCleanup()).resolves.toBeUndefined();
  });
});
