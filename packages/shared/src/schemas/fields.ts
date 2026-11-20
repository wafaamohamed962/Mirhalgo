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
