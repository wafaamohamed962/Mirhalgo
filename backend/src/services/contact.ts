import type { ContactInput } from '@mirhalgo/shared';
import { logEvent } from '../lib/logger.js';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mail } from './mail/index.js';

/**
 * POST /contact (spec 3.5): save a copy, then email the team.
 * Succeeds if at least one of them worked, so the customer never sends twice.
 */
export async function submitContactMessage(input: ContactInput, { ip }: { ip?: string }) {
  if (input.website) {
    // honeypot filled → bot. Pretend success, store nothing.
    logEvent('contact_spam', ip);
    return null;
  }

  const saved = await db
    .from('contact_messages')
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      message: input.message,
      ip: ip ?? null,
    })
    .select('id')
    .single();
  if (saved.error) console.error('contact: could not save message', saved.error.message);

  let emailSent = false;
  try {
    await mail.contact(input);
    emailSent = true;
  } catch {
    // already logged by the mail service; the saved copy is enough to succeed
  }

  if (saved.data && emailSent) {
    await db.from('contact_messages').update({ email_sent: true }).eq('id', saved.data.id);
  }
  if (!saved.data && !emailSent) throw new HttpError(503, 'MAIL_FAILED', 'Message not delivered');

  logEvent('contact_message', ip, { reason: emailSent ? 'emailed' : 'saved_only' });
  return null;
}
