import { SUPABASE_URL_RULE, isSupabaseProjectUrl } from '@mirhalgo/shared';
import { z } from 'zod';

/** Backend environment (spec 8.6). Validated once at startup; values are never logged. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url().refine(isSupabaseProjectUrl, SUPABASE_URL_RULE),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().email(),
  /** Gmail App Password. May be empty: the API still runs, email steps return MAIL_NOT_CONFIGURED. */
  SMTP_PASS: z.string().trim().default(''),
  CONTACT_TO: z.string().email(),
  OTP_PEPPER: z.string().min(32, 'must be at least 32 characters (random)'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;
