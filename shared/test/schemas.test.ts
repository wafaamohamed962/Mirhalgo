import { describe, expect, it } from 'vitest';
import {
  contactSchema,
  loginSchema,
  nameSchema,
  normalizePhone,
  passwordScore,
  phoneSchema,
  resetPasswordSchema,
  signupSchema,
  toE164,
  verifyEmailSchema,
} from '../src/index.js';

const validSignup = {
  firstName: 'محمد',
  lastName: 'Ali-Hassan',
  email: '  Test@Example.COM ',
  phone: '+201012345678',
  gender: 'male',
  password: 'Str0ng!pass',
  confirmPassword: 'Str0ng!pass',
  acceptTerms: true,
};

describe('nameSchema', () => {
  it.each(['Ali', 'عبد الله', 'Jean-Luc', 'مريم'])('accepts %s', (name) => {
    expect(nameSchema.safeParse(name).success).toBe(true);
  });
  it.each(['A', 'Ali3', 'a'.repeat(51), 'Ali  Omar', '-Ali', 'Ali_'])('rejects %s', (name) => {
    expect(nameSchema.safeParse(name).success).toBe(false);
  });
});

describe('phone', () => {
  it('accepts Egyptian mobile prefixes 10/11/12/15 only', () => {
    for (const p of ['10', '11', '12', '15']) {
      expect(phoneSchema.safeParse(`+20${p}12345678`).success).toBe(true);
    }
    expect(phoneSchema.safeParse('+201312345678').success).toBe(false);
    expect(phoneSchema.safeParse('+20101234567').success).toBe(false);
  });
  it('accepts other countries as generic E.164', () => {
    expect(phoneSchema.safeParse('+966501234567').success).toBe(true);
    expect(phoneSchema.safeParse('+9665').success).toBe(false);
  });
  it('builds E.164 from a national number', () => {
    expect(toE164('20', '010 1234-5678')).toBe('+201012345678');
    expect(toE164('20', '')).toBe('');
  });
  it('normalises login phone formats', () => {
    expect(normalizePhone('01012345678')).toBe('+201012345678');
    expect(normalizePhone('00201012345678')).toBe('+201012345678');
    expect(normalizePhone('+20 101 234 5678')).toBe('+201012345678');
    expect(normalizePhone('12345')).toBeNull();
  });
});

describe('password', () => {
  it('scores each rule', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(2);
    expect(passwordScore('Str0ng!pass')).toBe(5);
  });
});

describe('signupSchema', () => {
  it('accepts a valid payload and normalises the email', () => {
    const result = signupSchema.parse(validSignup);
    expect(result.email).toBe('test@example.com');
  });
  it('rejects mismatched passwords on confirmPassword', () => {
    const result = signupSchema.safeParse({ ...validSignup, confirmPassword: 'Other1!pass' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['confirmPassword'],
      message: 'validation.passwordMismatch',
    });
  });
  it('rejects weak passwords, missing terms and unknown gender', () => {
    expect(signupSchema.safeParse({ ...validSignup, password: 'weakpass' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, acceptTerms: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, gender: 'other' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('tags the identifier as email or phone', () => {
    expect(loginSchema.parse({ identifier: 'A@B.co', password: 'x' }).identifier).toEqual({
      type: 'email',
      value: 'a@b.co',
    });
    expect(loginSchema.parse({ identifier: '01012345678', password: 'x' }).identifier).toEqual({
      type: 'phone',
      value: '+201012345678',
    });
  });
  it('rejects identifiers that are neither', () => {
    expect(loginSchema.safeParse({ identifier: 'nobody', password: 'x' }).success).toBe(false);
  });
});

describe('OTP schemas', () => {
  it('requires exactly 6 digits', () => {
    expect(verifyEmailSchema.safeParse({ email: 'a@b.co', code: '123456' }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ email: 'a@b.co', code: '12345' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ email: 'a@b.co', code: '12345a' }).success).toBe(false);
  });
  it('reset requires a strong matching password', () => {
    const base = { email: 'a@b.co', code: '123456' };
    expect(
      resetPasswordSchema.safeParse({ ...base, password: 'Str0ng!x', confirmPassword: 'Str0ng!x' })
        .success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ ...base, password: 'Str0ng!x', confirmPassword: 'nope' })
        .success,
    ).toBe(false);
  });
});

describe('contactSchema', () => {
  const contact = {
    firstName: 'Ali',
    lastName: 'Omar',
    email: 'a@b.co',
    phone: '+201012345678',
    message: 'Hello there!',
  };
  it('enforces message length 10–2000', () => {
    expect(contactSchema.safeParse(contact).success).toBe(true);
    expect(contactSchema.safeParse({ ...contact, message: 'short' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...contact, message: 'x'.repeat(2001) }).success).toBe(false);
  });
});
