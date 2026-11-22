import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

/* HTTP layer: response shape, validation, CORS, limits. Services are mocked. */

vi.mock('../src/services/auth.js', () => ({
  signup: vi.fn(async (input: { email: string }) => ({ email: input.email, cooldownSeconds: 60 })),
  verifyEmail: vi.fn(),
  sendOtpIfEligible: vi.fn(async ({ email }: { email: string }) => ({
    email,
    cooldownSeconds: 60,
  })),
  login: vi.fn(async () => {
    const { HttpError } = await import('../src/middleware/errorHandler.js');
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password');
  }),
  resetPassword: vi.fn(),
}));
vi.mock('../src/services/contact.js', () => ({ submitContactMessage: vi.fn(async () => null) }));

const { createApp } = await import('../src/app.js');
const app = createApp();
const ORIGIN = 'http://localhost:5173';

const validSignup = {
  firstName: 'Ali',
  lastName: 'Omar',
  email: 'Ali@Example.com',
  phone: '+201012345678',
  gender: 'male',
  password: 'Str0ng!pass',
  confirmPassword: 'Str0ng!pass',
  acceptTerms: true,
};

describe('API', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, data: { status: 'up' } });
  });

  it('unknown route → 404 with the error shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('rejects origins outside the CORS allowlist', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_NOT_ALLOWED');
  });

  it('rejects bodies over 10kb', async () => {
    const res = await request(app)
      .post('/api/contact')
      .set('Origin', ORIGIN)
      .send({ message: 'x'.repeat(11 * 1024) });
    expect(res.status).toBe(413);
  });

  it('validates with the shared schema and normalises input', async () => {
    const bad = await request(app)
      .post('/api/auth/signup')
      .send({ ...validSignup, phone: '123' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const good = await request(app).post('/api/auth/signup').send(validSignup);
    expect(good.status).toBe(201);
    expect(good.body).toEqual({
      ok: true,
      data: { email: 'ali@example.com', cooldownSeconds: 60 },
    });
  });

  it('login errors are generic', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'someone@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email/phone or password',
    });
  });

  it('login is limited to 10 attempts per 15 minutes per identifier', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.0.0.${Math.floor(Math.random() * 250)}`)
        .send({ identifier: 'target@example.com', password: 'guess' });
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('resend has a 60 s cooldown per email (same answer for any email)', async () => {
    const resend = () =>
      request(app).post('/api/auth/resend-otp').send({ email: 'x@y.co', purpose: 'signup' });
    expect((await resend()).status).toBe(200);
    const second = await resend();
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('OTP_COOLDOWN');
  });

  it('contact form: 5 per hour per IP', async () => {
    const send = () =>
      request(app).post('/api/contact').set('X-Forwarded-For', '203.0.113.9').send({
        firstName: 'Ali',
        lastName: 'Omar',
        email: 'a@b.co',
        phone: '+201012345678',
        message: 'Hello, I need a quote.',
      });
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(429);
  });
});
