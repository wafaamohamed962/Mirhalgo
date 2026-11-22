import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TERMS_VERSION } from '@mirhalgo/shared';

/* POST /api/companies/register at the HTTP layer: multipart, limits, validation, rate limit. */

const registerCompany = vi.fn(async (app: { email: string }) => ({
  email: app.email,
  cooldownSeconds: 60,
}));
vi.mock('../src/services/companies.js', () => ({ registerCompany }));
// the country/region existence check lives in the service (mocked here)

const { createApp } = await import('../src/app.js');
const app = createApp();

const application = {
  legalName: 'Nile Shipping',
  representativeName: 'Ahmed Hassan',
  representativeTitle: 'Owner',
  email: 'Ops@Nile.com',
  phone: '+201012345678',
  whatsappSameAsMobile: true,
  country: 'EG',
  region: 'EG-GZ',
  city: 'Dokki',
  street: '5 Tahrir Street',
  password: 'Str0ng!pass',
  confirmPassword: 'Str0ng!pass',
  activities: ['other'],
  otherActivity: 'Warehousing',
  commercialRegisterNumber: '123',
  taxNumber: '123-456-789',
  confirmAccuracy: true,
  acceptTerms: true,
  termsVersion: TERMS_VERSION,
  role: 'admin', // unknown keys are stripped
};
const pdf = Buffer.from('%PDF-1.7 test');
let ipCounter = 0;
/** Each test uses its own client IP (trust proxy = 1), so the 3/hour limit does not leak. */
const post = (ip = `10.0.0.${++ipCounter}`) =>
  request(app).post('/api/companies/register').set('X-Forwarded-For', ip);

describe('POST /api/companies/register', () => {
  it('parses the multipart body, validates with the shared schema and passes the files on', async () => {
    const res = await post()
      .set('User-Agent', 'Vitest UA')
      .field('application', JSON.stringify(application))
      .attach('commercial_register', pdf, 'cr.pdf')
      .attach('tax_card', pdf, { filename: 'سجل.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, data: { email: 'ops@nile.com', cooldownSeconds: 60 } });

    const [parsed, files, ctx] = registerCompany.mock.calls.at(-1)! as unknown as [
      Record<string, unknown>,
      Record<string, Array<{ buffer: Buffer; size: number }>>,
      { ip: string; userAgent: string },
    ];
    expect(parsed).toMatchObject({
      email: 'ops@nile.com',
      taxNumber: '123456789',
      whatsapp: '+201012345678',
    });
    expect(parsed).not.toHaveProperty('role');
    expect(Object.keys(files).sort()).toEqual(['commercial_register', 'tax_card']);
    expect(files.tax_card![0]!.buffer.equals(pdf)).toBe(true);
    expect(ctx).toMatchObject({ userAgent: 'Vitest UA' });
    expect(ctx.ip).toMatch(/^10\.0\.0\./);
  });

  it.each([
    [
      'no application field',
      (r: request.Test) => r.attach('tax_card', pdf, 'a.pdf'),
      400,
      'VALIDATION_ERROR',
    ],
    [
      'a JSON body instead of multipart',
      (r: request.Test) => r.send({ application }),
      400,
      'VALIDATION_ERROR',
    ],
    ['invalid JSON', (r: request.Test) => r.field('application', '{oops'), 400, 'INVALID_JSON'],
    [
      'an invalid application',
      (r: request.Test) =>
        r.field('application', JSON.stringify({ ...application, taxNumber: '12' })),
      400,
      'VALIDATION_ERROR',
    ],
    [
      'an unknown file field',
      (r: request.Test) =>
        r.field('application', JSON.stringify(application)).attach('avatar', pdf, 'a.pdf'),
      400,
      'TOO_MANY_FILES',
    ],
    [
      'two files of the same type',
      (r: request.Test) =>
        r
          .field('application', JSON.stringify(application))
          .attach('tax_card', pdf, 'a.pdf')
          .attach('tax_card', pdf, 'b.pdf'),
      400,
      'TOO_MANY_FILES',
    ],
    [
      'a file over 5 MB',
      (r: request.Test) =>
        r
          .field('application', JSON.stringify(application))
          .attach('tax_card', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.pdf'),
      413,
      'FILE_TOO_LARGE',
    ],
    [
      'an application field over 16 KB',
      (r: request.Test) =>
        r.field('application', JSON.stringify({ ...application, notes: 'x'.repeat(17 * 1024) })),
      413,
      'PAYLOAD_TOO_LARGE',
    ],
    [
      'a second text field',
      (r: request.Test) => r.field('application', JSON.stringify(application)).field('extra', 'x'),
      413,
      'PAYLOAD_TOO_LARGE',
    ],
  ])('rejects %s', async (_name, build, status, code) => {
    const calls = registerCompany.mock.calls.length;
    const res = await build(post());
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ ok: false, error: { code, message: expect.any(String) } });
    expect(registerCompany.mock.calls.length).toBe(calls);
  });

  it('allows 3 requests per hour per IP (spec A5)', async () => {
    const ip = '10.9.9.9';
    for (let i = 0; i < 3; i++)
      expect((await post(ip).field('application', '{}')).status).toBe(400);
    const blocked = await post(ip).field('application', JSON.stringify(application));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect((await post('10.9.9.10').field('application', '{}')).status).toBe(400); // other IP
  });
});
