import { z } from 'zod';
import { GOVERNORATES } from '../company.js';
import { TICKET_CATEGORIES } from '../portal.js';
import { GENDERS } from './auth.js';
import {
  emailSchema,
  nameSchema,
  optional,
  otpCodeSchema,
  passwordSchema,
  phoneSchema,
  textSchema,
} from './fields.js';

/*
 * Customer portal forms (MW_002 Part B). Used by the web forms now and by the real API
 * later (same schemas on both sides).
 */

const required = () => ({ errorMap: () => ({ message: 'validation.required' }) });

export const PORTAL_LIMITS = {
  reason: { min: 1, max: 500 },
  question: { min: 5, max: 1000 },
  review: { min: 1, max: 500 },
  ticketSubject: { min: 3, max: 120 },
  ticketMessage: { min: 10, max: 2000 },
  addressLabel: { min: 2, max: 40 },
  city: { min: 2, max: 60 },
  street: { min: 5, max: 200 },
  landmark: { min: 2, max: 120 },
} as const;

export const profileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  gender: z.enum(GENDERS, required()),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const changeEmailSchema = z.object({ email: emailSchema });
export const changePhoneSchema = z.object({ phone: phoneSchema });
export const confirmCodeSchema = z.object({ code: otpCodeSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const addressSchema = z.object({
  label: textSchema(PORTAL_LIMITS.addressLabel, 'validation.addressLabelLength'),
  governorate: z.enum(GOVERNORATES, required()),
  city: textSchema(PORTAL_LIMITS.city, 'validation.cityLength'),
  street: textSchema(PORTAL_LIMITS.street, 'validation.streetLength'),
  landmark: optional(textSchema(PORTAL_LIMITS.landmark, 'validation.landmarkLength')),
  phone: phoneSchema,
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

/** Optional free-text reason (cancel a request, reject an offer). */
export const reasonSchema = z.object({
  reason: optional(
    textSchema(PORTAL_LIMITS.reason, 'validation.reasonLength', { multiline: true }),
  ),
});
export type ReasonInput = z.infer<typeof reasonSchema>;

export const questionSchema = z.object({
  question: textSchema(PORTAL_LIMITS.question, 'validation.questionLength', { multiline: true }),
});

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const reviewSchema = z.object({
  rating: z
    .number({ invalid_type_error: 'validation.rating', required_error: 'validation.rating' })
    .int()
    .min(RATING_MIN, 'validation.rating')
    .max(RATING_MAX, 'validation.rating'),
  comment: optional(
    textSchema(PORTAL_LIMITS.review, 'validation.reviewLength', { multiline: true }),
  ),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

/** The attachment travels as a file; its size/type are checked with checkFile('tax_card' rules). */
export const ticketSchema = z.object({
  subject: textSchema(PORTAL_LIMITS.ticketSubject, 'validation.subjectLength'),
  category: z.enum(TICKET_CATEGORIES, required()),
  orderReference: optional(z.string().max(40)),
  message: textSchema(PORTAL_LIMITS.ticketMessage, 'validation.messageLength', {
    multiline: true,
  }),
});
export type TicketInput = z.infer<typeof ticketSchema>;

export const ticketReplySchema = z.object({
  message: textSchema(PORTAL_LIMITS.ticketMessage, 'validation.messageLength', {
    multiline: true,
  }),
});

/** Danger zone: type DELETE + password (spec B6). */
export const DELETE_CONFIRMATION = 'DELETE';
export const deleteAccountSchema = z.object({
  confirmation: z.literal(DELETE_CONFIRMATION, {
    errorMap: () => ({ message: 'validation.typeDelete' }),
  }),
  password: z.string().min(1, 'validation.required'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
