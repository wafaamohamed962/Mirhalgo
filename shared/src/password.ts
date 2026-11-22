/**
 * Password policy (spec 4.2): min 8 chars, upper + lower case, number, symbol.
 * Shared by the Zod schema (validation) and the strength meter (UI).
 * Max 72 because Supabase hashes with bcrypt, which ignores bytes after 72.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const PASSWORD_RULES = [
  { id: 'length', test: (p: string) => p.length >= PASSWORD_MIN },
  { id: 'lower', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'number', test: (p: string) => /\d/.test(p) },
  { id: 'symbol', test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]['id'];

/** Number of satisfied rules (0–5). The password is accepted only when all pass. */
export function passwordScore(password: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}
