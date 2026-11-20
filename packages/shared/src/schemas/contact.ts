import { z } from 'zod';
import { emailSchema, nameSchema, phoneSchema } from './fields.js';

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 2000;

/** POST /api/contact (spec 3.5) */
export const contactSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  message: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_MIN, 'validation.messageLength')
    .max(CONTACT_MESSAGE_MAX, 'validation.messageLength'),
  /** Honeypot: hidden from humans. If filled, the server silently drops the message. */
  website: z.string().max(200).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;
