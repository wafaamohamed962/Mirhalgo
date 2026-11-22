import {
  type ApplicationStatus,
  type CompanyRegistration,
  type OtpSentResult,
  type UserRole,
} from '@mirhalgo/shared';
import { logEvent } from '../lib/logger.js';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { StoredFile } from '../types/database.js';
import { prepareFiles, type IncomingFiles, type PreparedFile } from './companyFiles.js';
import { assertMailConfigured, mail } from './mail/index.js';
import { issueOtp, otpSentResult } from './otp.js';
import { removeFiles, uploadCompanyFiles, type StoredDocument } from './storage.js';
import { UNIQUE_VIOLATION, deleteUser, findProfileByEmail, findProfileByPhone } from './users.js';

/*
 * Company registration (MW_002 spec A3). Duplicates (decision 1):
 *   email / phone → the same neutral answer as customer signup (+ an explanatory email);
 *   commercial register / tax number → explicit 409 COMPANY_ALREADY_REGISTERED.
 * All-or-nothing: the rows are written by ONE SQL function (one transaction); if anything
 * fails after the auth user was created, the uploaded files and the user are deleted.
 */

type Ctx = { ip?: string; userAgent?: string };

const neutral = otpSentResult;

const alreadyRegistered = () =>
  new HttpError(409, 'COMPANY_ALREADY_REGISTERED', 'Company already registered');

type Conflict = 'email' | 'phone' | 'legal';

/** Maps a unique violation (named constraints in the migrations) to what it means. */
function uniqueConflict(error: unknown): Conflict | null {
  const { code, message = '' } = (error ?? {}) as { code?: string; message?: string };
  if (code !== UNIQUE_VIOLATION) return null;
  if (message.includes('profiles_phone_key')) return 'phone';
  if (message.includes('profiles_email_key') || message.includes('profiles_pkey')) return 'email';
  if (/companies_(commercial_register_number|tax_number)_key/.test(message)) return 'legal';
  return null;
}

async function assertLegalNumbersFree(app: CompanyRegistration, ignoreCompanyId?: string) {
  // both values are digits only (shared schema), safe inside the filter string
  const { data, error } = await db
    .from('companies')
    .select('id')
    .or(
      `commercial_register_number.eq.${app.commercialRegisterNumber},tax_number.eq.${app.taxNumber}`,
    );
  if (error) throw error;
  if (data.some((row) => row.id !== ignoreCompanyId)) throw alreadyRegistered();
}

/** Rows for create_company_registration() (snake_case = the table columns). */
function toRegistrationArgs(
  userId: string,
  app: CompanyRegistration,
  stored: StoredDocument[],
  ctx: Ctx,
) {
  return {
    p_user_id: userId,
    p_email: app.email,
    p_phone: app.phone,
    p_company: {
      legal_name: app.legalName,
      representative_name: app.representativeName,
      representative_title: app.representativeTitle,
      whatsapp: app.whatsapp ?? null,
      landline: app.landline ?? null,
      website: app.website ?? null,
      governorate: app.governorate,
      city: app.city,
      street: app.street,
      activities: app.activities,
      other_activity: app.otherActivity ?? null,
      years_in_business: app.yearsInBusiness ?? null,
      commercial_register_number: app.commercialRegisterNumber,
      tax_number: app.taxNumber,
      notes: app.notes ?? null,
    },
    p_services: {
      international_modes: app.international?.modes ?? [],
      international_scope: app.international?.scope ?? null,
      international_countries: app.international?.countries ?? [],
      international_regions: app.international?.regions ?? [],
      domestic_all_governorates: app.domestic?.allGovernorates ?? false,
      domestic_governorates: app.domestic?.governorates ?? [],
      vehicle_types: app.domestic?.vehicleTypes ?? [],
      vehicle_type_other: app.domestic?.vehicleTypeOther ?? null,
      fleet_size: app.domestic?.fleetSize ?? null,
      china_sites: app.china?.sites ?? [],
      china_site_other: app.china?.siteOther ?? null,
      china_services: app.china?.services ?? [],
    },
    p_documents: stored.map(({ bucket, path, file }) => ({
      type: file.type,
      storage_bucket: bucket,
      storage_path: path,
      original_name: file.originalName,
      mime_type: file.mime,
      size_bytes: file.size,
    })),
    p_consent: {
      terms_version: app.termsVersion,
      submit_ip: ctx.ip ?? null,
      user_agent: ctx.userAgent?.slice(0, 512) ?? null,
    },
  };
}

/** Compensation: never throws, so the original error is the one reported. */
async function rollback(userId: string, stored: StoredFile[], ctx: Ctx, reason: string) {
  await removeFiles(stored);
  await deleteUser(userId).catch((error: Error) => {
    console.error(`companies: rollback could not delete user ${userId}: ${error.message}`);
  });
  logEvent('company_registration_failed', ctx.ip, { userId, reason });
}

type CreateResult =
  { ok: true; userId: string; reference: string } | { ok: false; conflict: Conflict };

/** Auth user → files → all rows in one transaction. Anything partial is rolled back. */
async function createRegistration(
  app: CompanyRegistration,
  files: PreparedFile[],
  ctx: Ctx,
): Promise<CreateResult> {
  const created = await db.auth.admin.createUser({
    email: app.email,
    password: app.password,
    email_confirm: false,
    app_metadata: { role: 'company' satisfies UserRole },
  });
  if (created.error) {
    if (created.error.code === 'email_exists') return { ok: false, conflict: 'email' }; // race
    throw created.error;
  }
  const userId = created.data.user.id;

  let stored: StoredDocument[] = [];
  try {
    stored = await uploadCompanyFiles(userId, files);
    const { data, error } = await db
      .rpc('create_company_registration', toRegistrationArgs(userId, app, stored, ctx))
      .single();
    if (error) throw error;
    return { ok: true, userId, reference: data.reference_number };
  } catch (error) {
    const conflict = uniqueConflict(error);
    await rollback(userId, stored, ctx, conflict ?? 'error');
    if (conflict) return { ok: false, conflict };
    throw error;
  }
}

/** Files of an unverified application that may be replaced (decision 2), else null. */
async function replaceablePendingRegistration(userId: string): Promise<StoredFile[] | null> {
  const { data: application, error } = await db
    .from('company_applications')
    .select('status')
    .eq('company_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (application?.status !== 'pending_verification') return null;

  const docs = await db
    .from('company_documents')
    .select('storage_bucket, storage_path')
    .eq('company_id', userId);
  if (docs.error) throw docs.error;
  return docs.data.map((d) => ({ bucket: d.storage_bucket, path: d.storage_path }));
}

/** Deletes an application completely: files first, then the user (rows cascade). */
async function deleteRegistration(userId: string, files: StoredFile[]): Promise<boolean> {
  if (!(await removeFiles(files))) return false; // keep the rows so a later run can retry
  await deleteUser(userId);
  return true;
}

/** POST /api/companies/register. Returns the same neutral answer as customer signup. */
export async function registerCompany(
  app: CompanyRegistration,
  incomingFiles: IncomingFiles | undefined,
  ctx: Ctx,
): Promise<OtpSentResult> {
  assertMailConfigured(); // every branch below sends an email (same answer for everybody)
  const files = await prepareFiles(incomingFiles);
  const existing = await findProfileByEmail(app.email);

  if (existing?.email_verified_at) {
    await mail.accountExists(app.email);
    logEvent('company_existing_email', ctx.ip, { userId: existing.id });
    return neutral(app.email);
  }

  // Unverified company application → replaced by this one. Anything else (an unverified
  // customer, or an application past verification) is left untouched (decision 2).
  const replaceFiles = existing ? await replaceablePendingRegistration(existing.id) : null;
  if (existing && (existing.role !== 'company' || !replaceFiles)) {
    logEvent('company_existing_email', ctx.ip, { userId: existing.id, reason: 'unverified' });
    return neutral(app.email);
  }
  const replaceId = existing?.id;

  await assertLegalNumbersFree(app, replaceId).catch((error: unknown) => {
    if (error instanceof HttpError)
      logEvent('company_already_registered', ctx.ip, { email: app.email });
    throw error;
  });

  const phoneOwner = await findProfileByPhone(app.phone);
  if (phoneOwner && phoneOwner.id !== replaceId) {
    await mail.phoneTaken(app.email);
    logEvent('company_phone_taken', ctx.ip, { email: app.email });
    return neutral(app.email);
  }

  if (replaceId && replaceFiles) {
    if (!(await deleteRegistration(replaceId, replaceFiles))) {
      throw new Error('companies: could not remove the previous application files');
    }
    logEvent('company_registration_replaced', ctx.ip, { userId: replaceId });
  }

  const result = await createRegistration(app, files, ctx);
  if (!result.ok) {
    if (result.conflict === 'legal') {
      logEvent('company_already_registered', ctx.ip, { email: app.email });
      throw alreadyRegistered();
    }
    if (result.conflict === 'phone') await mail.phoneTaken(app.email);
    logEvent(
      result.conflict === 'phone' ? 'company_phone_taken' : 'company_existing_email',
      ctx.ip,
      {
        email: app.email,
        reason: 'race',
      },
    );
    return neutral(app.email);
  }

  logEvent('company_registered', ctx.ip, { userId: result.userId, reference: result.reference });
  await issueOtp({ userId: result.userId, email: app.email, purpose: 'signup', ip: ctx.ip });
  return neutral(app.email);
}

/**
 * Called by POST /auth/verify-email for a company: pending_verification → pending_review,
 * then the confirmation email + the team notice (decision 12). Idempotent: verifying again
 * after a partial failure does not move the status twice or resend the emails.
 */
export async function completeCompanyVerification(
  userId: string,
  email: string,
  { ip }: Ctx,
): Promise<{ referenceNumber: string; status: ApplicationStatus }> {
  const { data: application, error } = await db
    .from('company_applications')
    .select('id, reference_number, status')
    .eq('company_id', userId)
    .single();
  if (error) throw error;
  const result = { referenceNumber: application.reference_number, status: application.status };
  if (application.status !== 'pending_verification') return result;

  const moved = await db.rpc('transition_application_status', {
    p_application_id: application.id,
    p_to: 'pending_review',
    p_actor_type: 'company',
    p_actor_id: userId,
  });
  if (moved.error) throw moved.error;
  logEvent('company_application_submitted', ip, { userId, reference: result.referenceNumber });

  const company = await db
    .from('companies')
    .select('legal_name, governorate, activities')
    .eq('id', userId)
    .single();
  if (company.error) throw company.error;

  // Email failures are logged by mail.send(); they never undo a successful verification.
  const { legal_name: legalName, governorate, activities } = company.data;
  await Promise.allSettled([
    mail.companyApplicationReceived(email, { referenceNumber: result.referenceNumber, legalName }),
    mail.newCompanyApplication({
      referenceNumber: result.referenceNumber,
      legalName,
      email,
      governorate,
      activities,
    }),
  ]);
  return { ...result, status: moved.data };
}

/**
 * Decision 10: deletes unverified applications older than 7 days (files, then the user;
 * rows cascade). Not scheduled yet: run `npm run cleanup:companies -w apps/api`.
 */
export async function cleanupExpiredRegistrations(): Promise<number> {
  const { data, error } = await db.rpc('list_expired_company_registrations', {});
  if (error) throw error;
  let deleted = 0;
  for (const row of data) {
    if (await deleteRegistration(row.user_id, row.documents)) {
      deleted++;
      logEvent('company_registration_expired', undefined, { userId: row.user_id });
    }
  }
  return deleted;
}
