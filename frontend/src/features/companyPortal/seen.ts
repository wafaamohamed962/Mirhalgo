import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/hooks/useAuth';

/*
 * "New" badges (MW_004 spec B2): requests, offers and inquiries the company has not opened
 * yet. The opened ids are kept per account in localStorage (mock; the real API can move this
 * to the server). An offer is stored with its status, so a status change makes it new again
 * (plan Q12).
 */

export type SeenKind = 'request' | 'offer' | 'inquiry';
type Seen = Record<SeenKind, string[]>;

const KEY_PREFIX = 'mirhalgo.companySeen.v1.';
const CHANGED = 'mirhalgo:company-seen';
const EMPTY: Seen = { request: [], offer: [], inquiry: [] };

const read = (accountId: string): Seen => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + accountId);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Seen>) } : EMPTY;
  } catch {
    return EMPTY;
  }
};

/** Snapshot cache: useSyncExternalStore needs the same object until something changes. */
const snapshots = new Map<string, { raw: string | null; value: Seen }>();
function snapshot(accountId: string): Seen {
  const raw = localStorage.getItem(KEY_PREFIX + accountId);
  const cached = snapshots.get(accountId);
  if (cached && cached.raw === raw) return cached.value;
  const value = read(accountId);
  snapshots.set(accountId, { raw, value });
  return value;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onChange); // another tab
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** `id` (+ `version`, e.g. an offer's status) as stored. */
const entry = (id: string, version?: string) => (version ? `${id}:${version}` : id);

/** Forgets everything opened by this account ("Reset demo data"). */
export function clearSeen(accountId: string) {
  localStorage.removeItem(KEY_PREFIX + accountId);
  window.dispatchEvent(new Event(CHANGED));
}

export function useSeen() {
  const accountId = useAuth().session?.user.id ?? '';
  const seen = useSyncExternalStore(subscribe, () => snapshot(accountId));

  const isNew = useCallback(
    (kind: SeenKind, id: string, version?: string) => !seen[kind].includes(entry(id, version)),
    [seen],
  );
  const markSeen = useCallback(
    (kind: SeenKind, id: string, version?: string) => {
      const current = read(accountId);
      const value = entry(id, version);
      if (!accountId || current[kind].includes(value)) return;
      // an offer keeps only its latest status
      const others = version ? current[kind].filter((e) => !e.startsWith(`${id}:`)) : current[kind];
      localStorage.setItem(
        KEY_PREFIX + accountId,
        JSON.stringify({ ...current, [kind]: [...others, value] }),
      );
      window.dispatchEvent(new Event(CHANGED));
    },
    [accountId],
  );
  return { isNew, markSeen };
}
