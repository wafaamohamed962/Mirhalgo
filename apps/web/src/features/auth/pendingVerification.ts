/**
 * The account waiting for email verification (/verify-email).
 * - email: sessionStorage, so a reload keeps the page usable.
 * - password: memory ONLY (never stored), used to log in automatically after the
 *   code is verified. Lost on reload → the user logs in manually (CLAUDE.md §11).
 */
const STORAGE_KEY = 'mirhalgo.pendingEmail';

let pendingPassword: string | null = null;

export type PendingVerification = { email: string; password: string | null };

export function setPendingVerification(email: string, password: string) {
  pendingPassword = password;
  try {
    sessionStorage.setItem(STORAGE_KEY, email);
  } catch {
    // storage blocked: verification still works in this tab via memory
  }
}

export function getPendingVerification(): PendingVerification | null {
  let email: string | null = null;
  try {
    email = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    email = null;
  }
  return email ? { email, password: pendingPassword } : null;
}

export function clearPendingVerification() {
  pendingPassword = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
