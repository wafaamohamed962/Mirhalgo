import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OTP_MAX_ATTEMPTS } from '@mirhalgo/shared';

/*
 * Unit tests for the OTP service. Supabase and SMTP are mocked, so the statuses
 * returned by the SQL function claim_otp_attempt (backend/supabase/migrations) are simulated.
 */

const rpcResult = vi.fn();
const updateCalls: Array<Record<string, unknown>> = [];
let consumedRows: Array<{ id: string }> = [{ id: 'otp-1' }];

// Minimal chainable stand-in for the supabase-js query builder.
function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ['eq', 'is', 'gte', 'order', 'select']) {
    builder[method] = () => builder;
  }
  builder.single = () => Promise.resolve(result);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    rpc: () => ({ single: () => Promise.resolve(rpcResult()) }),
    from: () => ({
      update: (values: Record<string, unknown>) => {
        updateCalls.push(values);
        return chain({ data: consumedRows, error: null });
      },
    }),
  },
}));
vi.mock('../src/services/mail/index.js', () => ({ mail: { otp: vi.fn() } }));
vi.spyOn(console, 'log').mockImplementation(() => {});

const { generateOtpCode, hashOtp, otpHashesMatch, verifyOtp } =
  await import('../src/services/otp.js');

const claim = (overrides: Record<string, unknown>) => ({
  data: {
    status: 'ok',
    otp_id: 'otp-1',
    user_id: 'user-1',
    code_hash: hashOtp('123456'),
    attempts: 1,
    ...overrides,
  },
  error: null,
});

const verify = (code: string) =>
  verifyOtp({ email: 'a@b.co', purpose: 'signup', code, ip: '127.0.0.1' });

beforeEach(() => {
  updateCalls.length = 0;
  consumedRows = [{ id: 'otp-1' }];
});

describe('OTP crypto', () => {
  it('generates 6-digit codes (leading zeros kept)', () => {
    for (let i = 0; i < 200; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('stores an HMAC-SHA256 hex digest, never the code', () => {
    const hash = hashOtp('123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('123456');
    expect(hashOtp('123456')).toBe(hash);
    expect(hashOtp('123457')).not.toBe(hash);
  });

  it('compares hashes safely', () => {
    expect(otpHashesMatch(hashOtp('1'), hashOtp('1'))).toBe(true);
    expect(otpHashesMatch(hashOtp('1'), hashOtp('2'))).toBe(false);
    expect(otpHashesMatch(hashOtp('1'), 'abcd')).toBe(false); // different length
  });
});

describe('verifyOtp', () => {
  it('accepts the right code and consumes it (single use)', async () => {
    rpcResult.mockReturnValue(claim({}));
    await expect(verify('123456')).resolves.toBe('user-1');
    expect(updateCalls[0]).toHaveProperty('consumed_at');
  });

  it('rejects a wrong code', async () => {
    rpcResult.mockReturnValue(claim({ attempts: 2 }));
    await expect(verify('000000')).rejects.toMatchObject({ code: 'OTP_INVALID', status: 400 });
  });

  it('invalidates the code on the 5th wrong attempt', async () => {
    rpcResult.mockReturnValue(claim({ attempts: OTP_MAX_ATTEMPTS }));
    await expect(verify('000000')).rejects.toMatchObject({ code: 'OTP_TOO_MANY_ATTEMPTS' });
    expect(updateCalls[0]).toHaveProperty('invalidated_at');
  });

  it('blocks the 6th attempt even with the right code', async () => {
    rpcResult.mockReturnValue(claim({ status: 'exhausted', code_hash: null }));
    await expect(verify('123456')).rejects.toMatchObject({ code: 'OTP_TOO_MANY_ATTEMPTS' });
  });

  it('rejects expired and reused/unknown codes', async () => {
    rpcResult.mockReturnValue(claim({ status: 'expired', code_hash: null }));
    await expect(verify('123456')).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
    rpcResult.mockReturnValue(claim({ status: 'none', otp_id: null, user_id: null }));
    await expect(verify('123456')).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('rejects when a parallel request consumed the code first', async () => {
    rpcResult.mockReturnValue(claim({}));
    consumedRows = [];
    await expect(verify('123456')).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });
});
