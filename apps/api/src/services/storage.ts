import { randomUUID } from 'node:crypto';
import type { DocumentType } from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';
import type { StoredFile } from '../types/database.js';
import type { PreparedFile } from './companyFiles.js';

/*
 * Company files in Supabase Storage (spec A5, decision 4). Both buckets are private:
 * no public URLs. Names are random UUIDs: `{company_id}/{uuid}.{ext}`.
 */

const bucketFor = (type: DocumentType) => (type === 'logo' ? 'company-logos' : 'company-documents');

export type StoredDocument = StoredFile & { file: PreparedFile };

/**
 * Uploads the files. If one upload fails, the ones already uploaded are removed before
 * the error is rethrown, so the caller only has to clean up after a later failure.
 */
export async function uploadCompanyFiles(
  companyId: string,
  files: PreparedFile[],
): Promise<StoredDocument[]> {
  const stored: StoredDocument[] = [];
  try {
    for (const file of files) {
      const bucket = bucketFor(file.type);
      const filePath = `${companyId}/${randomUUID()}.${file.extension}`;
      const { error } = await db.storage
        .from(bucket)
        .upload(filePath, file.buffer, { contentType: file.mime, upsert: false });
      if (error) throw error;
      stored.push({ bucket, path: filePath, file });
    }
    return stored;
  } catch (error) {
    await removeFiles(stored);
    throw error;
  }
}

/** Best effort: never throws. Returns false if some file could not be removed (logged). */
export async function removeFiles(files: StoredFile[]): Promise<boolean> {
  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of files)
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);

  let ok = true;
  for (const [bucket, paths] of byBucket) {
    const { error } = await db.storage.from(bucket).remove(paths);
    if (error) {
      ok = false;
      console.error(
        `storage: could not remove ${paths.length} file(s) from ${bucket}: ${error.message}`,
      );
    }
  }
  return ok;
}
