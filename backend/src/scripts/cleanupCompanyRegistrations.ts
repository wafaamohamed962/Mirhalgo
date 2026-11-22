import { cleanupExpiredRegistrations } from '../services/companies.js';

/** Decision 10: removes unverified company applications older than 7 days (not scheduled yet). */
const deleted = await cleanupExpiredRegistrations();
console.log(`cleanup: removed ${deleted} expired company application(s)`);
