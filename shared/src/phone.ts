/**
 * Phone helpers (spec 4.2): numbers are stored in E.164 (`+201012345678`).
 * Egypt (+20, default) is validated strictly: mobile prefixes 10/11/12/15.
 * Other countries are validated as generic E.164 (8–15 digits).
 */

export type Country = { iso: string; dial: string };

export const DEFAULT_COUNTRY: Country = { iso: 'EG', dial: '20' };

/** Curated list; names are rendered per locale with Intl.DisplayNames. */
export const COUNTRIES: readonly Country[] = [
  DEFAULT_COUNTRY,
  { iso: 'SA', dial: '966' },
  { iso: 'AE', dial: '971' },
  { iso: 'KW', dial: '965' },
  { iso: 'QA', dial: '974' },
  { iso: 'BH', dial: '973' },
  { iso: 'OM', dial: '968' },
  { iso: 'JO', dial: '962' },
  { iso: 'LY', dial: '218' },
  { iso: 'SD', dial: '249' },
  { iso: 'CN', dial: '86' },
  { iso: 'TR', dial: '90' },
  { iso: 'GB', dial: '44' },
  { iso: 'US', dial: '1' },
];

const E164 = /^\+[1-9]\d{7,14}$/;
const EGYPT_MOBILE = /^\+201[0125]\d{8}$/;

export function isValidPhone(e164: string): boolean {
  if (!E164.test(e164)) return false;
  return e164.startsWith(`+${DEFAULT_COUNTRY.dial}`) ? EGYPT_MOBILE.test(e164) : true;
}

/** Builds E.164 from a dial code and a national number typed by the user ("010 1234 5678"). */
export function toE164(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `+${dial}${digits}` : '';
}

/**
 * Normalises a phone typed on the login form. Accepts "+20…", "0020…" and
 * local Egyptian "01…". Returns E.164, or null when it is not a valid phone.
 */
export function normalizePhone(raw: string): string | null {
  let value = raw.replace(/[\s\-().]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  else if (value.startsWith('0')) value = `+${DEFAULT_COUNTRY.dial}${value.slice(1)}`;
  else if (!value.startsWith('+')) value = `+${value}`;
  return isValidPhone(value) ? value : null;
}

/**
 * Splits an E.164 number into one of `COUNTRIES` and the national digits, so a saved value
 * can be shown again ("+201012345678" → Egypt + "1012345678"). Unknown codes → null.
 */
export function splitE164(e164: string): { country: Country; national: string } | null {
  if (!e164.startsWith('+')) return null;
  const country = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => e164.startsWith(`+${c.dial}`));
  return country ? { country, national: e164.slice(country.dial.length + 1) } : null;
}
