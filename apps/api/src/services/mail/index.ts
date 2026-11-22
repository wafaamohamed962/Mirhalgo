import nodemailer from 'nodemailer';
import type { ContactInput, OtpPurpose } from '@mirhalgo/shared';
import { config } from '../../config.js';
import { HttpError } from '../../middleware/errorHandler.js';
import {
  accountExistsEmail,
  companyApplicationReceivedEmail,
  contactEmail,
  newCompanyApplicationEmail,
  otpEmail,
  phoneTakenEmail,
  type MailContent,
} from './templates.js';

/** Gmail SMTP via App Password (spec section 1). Port 465 = implicit TLS. */
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
});

const FROM = { name: 'MirhalGo', address: config.SMTP_USER };

const mailConfigured = config.SMTP_PASS.length > 0;

/**
 * Call BEFORE any account lookup in flows that may send an email, so the answer is the
 * same for every address (no user enumeration) when SMTP_PASS is not set.
 */
export function assertMailConfigured() {
  if (!mailConfigured) {
    throw new HttpError(503, 'MAIL_NOT_CONFIGURED', 'Email sending is not configured');
  }
}

/** Any SMTP failure surfaces as MAIL_FAILED (the message is logged, never sent to clients). */
async function send(to: string, content: MailContent, replyTo?: string) {
  assertMailConfigured();
  try {
    await transporter.sendMail({ from: FROM, to, replyTo, ...content });
  } catch (error) {
    console.error(`mail: send failed: ${(error as Error).message}`);
    throw new HttpError(503, 'MAIL_FAILED', 'Could not send the email');
  }
}

export const mail = {
  otp: (to: string, code: string, purpose: OtpPurpose) => send(to, otpEmail(code, purpose)),
  accountExists: (to: string) => send(to, accountExistsEmail()),
  phoneTaken: (to: string) => send(to, phoneTakenEmail()),
  /** To the team inbox; Reply-To = the customer (spec 3.5). */
  contact: (input: ContactInput) => send(config.CONTACT_TO, contactEmail(input), input.email),
  companyApplicationReceived: (
    to: string,
    details: Parameters<typeof companyApplicationReceivedEmail>[0],
  ) => send(to, companyApplicationReceivedEmail(details)),
  /** To the team inbox (decision 12). */
  newCompanyApplication: (details: Parameters<typeof newCompanyApplicationEmail>[0]) =>
    send(config.CONTACT_TO, newCompanyApplicationEmail(details)),
};

/** Startup check of the SMTP credentials (logs only, never blocks the API). */
export function verifyMailTransport() {
  if (!mailConfigured) {
    console.warn('SMTP_PASS is empty: OTP and contact emails are disabled (MAIL_NOT_CONFIGURED).');
    return;
  }
  transporter.verify().then(
    () => console.log('SMTP ready'),
    (error: Error) => console.error(`SMTP not ready: ${error.message}`),
  );
}
