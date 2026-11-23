import * as fixtures from './fixtures';

/**
 * In-memory mock state (MW_002 B2): a deep copy of the fixtures, changed by mutations for
 * the rest of the session (a page reload starts again). Tests create a fresh one each time.
 */
export function createMockDb() {
  const copy = <T>(value: T): T => structuredClone(value);
  return {
    me: copy(fixtures.me),
    // only for the (still mocked) Account › Requests balance page; the New Request page reads
    // the real balance from GET /me/summary (MW_003 B2)
    attempts: { remaining: fixtures.attemptsRemaining, total: fixtures.ATTEMPTS_TOTAL },
    orders: copy(fixtures.orders),
    companies: copy(fixtures.companies),
    reviews: copy(fixtures.reviews),
    notifications: copy(fixtures.notifications),
    prefs: copy(fixtures.notificationPrefs),
    sessions: copy(fixtures.sessions),
    activity: copy(fixtures.loginActivity),
    addresses: copy(fixtures.addresses),
    balanceHistory: copy(fixtures.balanceHistory),
    tickets: copy(fixtures.tickets),
    /** Pending email/phone change waiting for its code. */
    pendingChange: null as { kind: 'email' | 'phone'; value: string } | null,
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
