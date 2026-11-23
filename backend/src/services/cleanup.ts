import { logEvent } from '../lib/logger.js';
import { db } from '../lib/supabase.js';
import { cleanupExpiredRegistrations } from './companies.js';
import { deleteDraftWithFiles } from './orderDrafts.js';
import { ORDER_BUCKET } from './orderUploads.js';
import { removeFiles } from './storage.js';

/*
 * Scheduled cleanup (MW_003 B3, plan §5 items 16–17 + MW_002 decision 10):
 * - uploads attached to no draft and no order for 24 hours (spec B7);
 * - drafts not saved for 30 days, with their files;
 * - unverified company applications older than 7 days.
 * Runs hourly inside the API (startCleanupSchedule) and on demand with `npm run cleanup`.
 * A DB lease makes sure only one API instance runs it at a time. On a free Render instance
 * that sleeps, schedule `npm run cleanup` externally too (Render Cron Job).
 */

const HOUR = 60 * 60 * 1000;
const LEASE_SECONDS = 50 * 60;

/** Deletes orphan uploads: files first, rows only for the files that are gone. */
export async function cleanupOrphanUploads(): Promise<number> {
  const { data, error } = await db.rpc('list_orphan_uploads', {});
  if (error) throw error;
  if (data.length === 0) return 0;
  if (!(await removeFiles(data.map((u) => ({ bucket: ORDER_BUCKET, path: u.storage_path }))))) {
    return 0; // storage failed: keep the rows, the next run retries
  }
  const deleted = await db
    .from('order_uploads')
    .delete()
    .in(
      'id',
      data.map((u) => u.upload_id),
    );
  if (deleted.error) throw deleted.error;
  return data.length;
}

/** Deletes drafts not saved for 30 days (and their files). */
export async function cleanupExpiredDrafts(): Promise<number> {
  const { data, error } = await db.rpc('list_expired_drafts', {});
  if (error) throw error;
  let deleted = 0;
  for (const row of data) if (await deleteDraftWithFiles(row.draft_id)) deleted++;
  return deleted;
}

export async function runCleanup() {
  const result = {
    uploads: await cleanupOrphanUploads(),
    drafts: await cleanupExpiredDrafts(),
    companies: await cleanupExpiredRegistrations(),
  };
  logEvent('cleanup_run', undefined, {
    reason: `uploads=${result.uploads} drafts=${result.drafts} companies=${result.companies}`,
  });
  return result;
}

/** Runs the cleanup if no other instance holds the lease. Never throws (logged). */
export async function runScheduledCleanup(): Promise<void> {
  try {
    const { data: claimed, error } = await db.rpc('claim_job_lease', {
      p_name: 'cleanup',
      p_seconds: LEASE_SECONDS,
    });
    if (error) throw error;
    if (claimed) await runCleanup();
  } catch (error) {
    console.error(`cleanup: run failed: ${(error as Error).message}`);
  }
}

/** Hourly, first run a minute after start. The timer never keeps the process alive. */
export function startCleanupSchedule(intervalMs = HOUR) {
  setTimeout(() => void runScheduledCleanup(), 60_000).unref();
  setInterval(() => void runScheduledCleanup(), intervalMs).unref();
}
