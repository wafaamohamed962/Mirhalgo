import type { SignupInput, UserRole } from '@mirhalgo/shared';
import { db } from '../lib/supabase.js';

/*
 * Supabase Auth (Admin API) + profiles. Supabase stores and hashes passwords;
 * users are created with the email unconfirmed, so Supabase sends no emails.
 * The role is written to app_metadata (source of truth, in the JWT, only the service role
 * can change it) and mirrored to profiles.role (MW_002 decision 3).
 */

export const UNIQUE_VIOLATION = '23505';

export type ProfileRef = {
  id: string;
  email: string;
  role: UserRole;
  email_verified_at: string | null;
};

type CustomerDetails = Pick<
  SignupInput,
  'firstName' | 'lastName' | 'email' | 'phone' | 'gender' | 'password'
>;

/** Result of writing a customer: the phone may belong to someone else (unique). */
export type WriteCustomerResult =
  { ok: true; userId: string } | { ok: false; reason: 'phone_taken' };

async function findProfile(column: 'email' | 'phone', value: string): Promise<ProfileRef | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, email, role, email_verified_at')
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const findProfileByEmail = (email: string) => findProfile('email', email);
export const findProfileByPhone = (phone: string) => findProfile('phone', phone);

const profileFields = (input: CustomerDetails) => ({
  first_name: input.firstName,
  last_name: input.lastName,
  gender: input.gender,
  phone: input.phone,
});

/** New customer: auth user (email unconfirmed) + profile. Rolls back the user if the profile fails. */
export async function createCustomer(input: CustomerDetails): Promise<WriteCustomerResult> {
  const created = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false,
    app_metadata: { role: 'customer' satisfies UserRole },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  const { error } = await db
    .from('profiles')
    .insert({ id: userId, email: input.email, ...profileFields(input) });
  if (error) {
    await db.auth.admin.deleteUser(userId); // best effort rollback
    if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: 'phone_taken' };
    throw error;
  }
  return { ok: true, userId };
}

/** Signup again with an email that was never verified: refresh password + details. */
export async function refreshUnverifiedCustomer(
  userId: string,
  input: CustomerDetails,
): Promise<WriteCustomerResult> {
  const { error } = await db.from('profiles').update(profileFields(input)).eq('id', userId);
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, reason: 'phone_taken' };
  if (error) throw error;

  await setPassword(userId, input.password);
  return { ok: true, userId };
}

export async function confirmEmail(userId: string) {
  const confirmed = await db.auth.admin.updateUserById(userId, { email_confirm: true });
  if (confirmed.error) throw confirmed.error;

  const { error } = await db
    .from('profiles')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function setPassword(userId: string, password: string) {
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
}

/** Deletes the auth user; every row cascades (profile, company, OTPs…). Files are not rows. */
export async function deleteUser(userId: string) {
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** Signs the user out everywhere (refresh tokens + sessions), e.g. after a password reset. */
export async function revokeSessions(userId: string) {
  const { error } = await db.rpc('revoke_user_sessions', { p_user_id: userId });
  if (error) throw error;
}
