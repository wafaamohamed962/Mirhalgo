/**
 * The account waiting for email verification (/verify-email).
 * - email + kind: sessionStorage, so a reload keeps the page usable.
 * - password: memory ONLY (never stored), used to log a customer in automatically after
 *   the code is verified. Lost on reload → the user logs in manually (CLAUDE.md §11).
 *   Companies are never logged in automatically (MW_002 decision 6): no password kept.
 */
const EMAIL_KEY = 'mirhalgo.pendingEmail';
const KIND_KEY = 'mirhalgo.pendingKind';

export type PendingKind = 'customer' | 'company';
export type PendingVerification = { email: string; password: string | null; kind: PendingKind };

let pendingPassword: string | null = null;

export function setPendingVerification(
  email: string,
  password: string | null,
  kind: PendingKind = 'customer',
) {
  pendingPassword = password;
  try {
    sessionStorage.setItem(EMAIL_KEY, email);
    sessionStorage.setItem(KIND_KEY, kind);
  } catch {
    // storage blocked: verification still works in this tab via memory
  }
}

export function getPendingVerification(): PendingVerification | null {
  let email: string | null = null;
  let kind: string | null = null;
  try {
    email = sessionStorage.getItem(EMAIL_KEY);
    kind = sessionStorage.getItem(KIND_KEY);
  } catch {
    email = null;
  }
  if (!email) return null;
  return { email, password: pendingPassword, kind: kind === 'company' ? 'company' : 'customer' };
}

export function clearPendingVerification() {
  pendingPassword = null;
  try {
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(KIND_KEY);
  } catch {
    // ignore
  }
}
