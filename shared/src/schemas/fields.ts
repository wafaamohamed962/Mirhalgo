import { z } from 'zod';
import { OTP_LENGTH } from '../otp.js';
import { isValidPhone } from '../phone.js';
import { PASSWORD_MAX, PASSWORD_RULES, passwordScore } from '../password.js';

/*
 * Field schemas reused by every form. Error messages are i18n keys
 * (`validation.*`) translated by the web app.
 */

const LETTER = 'A-Za-z\\u0621-\\u064A';
// Arabic/English letters; words separated by a single space or "-" (spec 4.2).
const NAME_PATTERN = new RegExp(`^[${LETTER}]+(?:[ -][${LETTER}]+)*$`);

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'validation.nameLength')
  .max(50, 'validation.nameLength')
  .regex(NAME_PATTERN, 'validation.nameChars');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'validation.required')
  .max(254, 'validation.email')
  .email('validation.email');

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine(isValidPhone, 'validation.phone');

export const passwordSchema = z
  .string()
  .max(PASSWORD_MAX, 'validation.passwordMax')
  .refine((p) => passwordScore(p) === PASSWORD_RULES.length, 'validation.passwordWeak');

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), 'validation.otp');

// ── Generic helpers (MW_002) ──────────────────────────────────────────────

// Control characters (tab/newline excluded) are never valid in user text.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const LINE_BREAKS = /[\t\n\r]/;

/** Trimmed free text with a length range; `multiline` allows line breaks (notes). */
export const textSchema = (
  { min, max }: { min: number; max: number },
  lengthError: string,
  { multiline = false } = {},
) =>
  z
    .string()
    .trim()
    .min(1, 'validation.required')
    .min(min, lengthError)
    .max(max, lengthError)
    .refine(
      (value) => !CONTROL_CHARS.test(value) && (multiline || !LINE_BREAKS.test(value)),
      'validation.invalidChars',
    );

/**
 * Optional form field: an empty (or blank) string becomes `undefined`, anything else must
 * match `schema`. Forms send "" for empty inputs.
 */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value : undefined))
    .pipe(schema.optional());

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII, so Arabic keyboards work. */
export const toAsciiDigits = (value: string) =>
  value.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));

/** Digits-only string (spaces and dashes typed by the user are removed). */
export const digitsSchema = ({ min, max }: { min: number; max: number }, error: string) =>
  z
    .string()
    .transform((value) => toAsciiDigits(value).replace(/[\s-]/g, ''))
    .pipe(z.string().min(1, 'validation.required'))
    .pipe(z.string().regex(new RegExp(`^[0-9]{${min},${max}}$`), error));

/**
 * Optional whole number from a form input ("" / NaN = empty) or JSON.
 */
export const optionalIntSchema = ({ min, max }: { min: number; max: number }, error: string) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || Number.isNaN(value)) return undefined;
      return typeof value === 'string' ? Number(toAsciiDigits(value.trim())) : value;
    },
    z.number({ invalid_type_error: error }).int(error).min(min, error).max(max, error).optional(),
  );

/** http(s) URL. A bare domain ("facebook.com/x") gets `https://` in front. */
export const urlSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'validation.url')
    .transform((value) => (/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')
        );
      } catch {
        return false;
      }
    }, 'validation.url');
