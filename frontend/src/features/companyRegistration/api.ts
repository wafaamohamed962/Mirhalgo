import { checkFile, detectMime, type DocumentType, type OtpSentResult } from '@mirhalgo/shared';
import { apiUpload } from '../../lib/apiClient';
import type { CompanyFormValues } from './model';

/**
 * POST /api/companies/register (multipart): the raw form values as the `application` JSON
 * (the server normalises them with the same shared schema) + one part per document.
 */
export function registerCompany(
  { files, ...application }: CompanyFormValues,
  onProgress?: (percent: number) => void,
) {
  const body = new FormData();
  body.append('application', JSON.stringify(application));
  for (const [type, file] of Object.entries(files)) {
    if (file) body.append(type, file, file.name);
  }
  return apiUpload<OtpSentResult>('/companies/register', body, onProgress);
}

/**
 * Instant check of a picked file with the same rules as the server: real type from the
 * first bytes (magic bytes) + size. Returns an i18n key or null. The server checks again.
 */
export async function checkPickedFile(file: File, type: DocumentType): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return checkFile({ size: file.size, mime: detectMime(head) }, type);
}
