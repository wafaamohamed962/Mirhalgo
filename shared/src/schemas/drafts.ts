import { z } from 'zod';
import type { UploadedFile } from '../orderFiles.js';
import { ORDER_FILE_LIMITS } from '../orderFiles.js';
import type { ServiceType } from '../portal.js';

/*
 * Server drafts of the New Request forms (MW_003 B3). The payload is the form as typed (not
 * validated: a draft may be half-filled); it is only bounded. The full shared order schema
 * runs on submit (B4).
 */

/** "<service>@<n>": bumped when a form changes shape, so old drafts can be migrated. */
export const FORM_VERSION_PATTERN = /^[a-z0-9_.@-]{1,40}$/;
/** Draft payload limit (the DB column allows 64 KB; JSON text is a bit larger than jsonb). */
export const DRAFT_PAYLOAD_MAX_CHARS = 60_000;

export const orderDraftSchema = z.object({
  payload: z
    .record(z.unknown())
    .refine(
      (payload) => JSON.stringify(payload).length <= DRAFT_PAYLOAD_MAX_CHARS,
      'validation.draftTooLarge',
    ),
  formVersion: z.string().regex(FORM_VERSION_PATTERN),
  uploadIds: z
    .array(z.string().uuid())
    .max(ORDER_FILE_LIMITS.filesPerOrder)
    .refine((ids) => new Set(ids).size === ids.length, 'validation.duplicate')
    .default([]),
});
export type OrderDraftInput = z.input<typeof orderDraftSchema>;

/** GET /api/orders/drafts/:service (null when there is none). */
export type OrderDraft = {
  service: ServiceType;
  payload: Record<string, unknown>;
  formVersion: string;
  uploads: UploadedFile[];
  updatedAt: string;
};
