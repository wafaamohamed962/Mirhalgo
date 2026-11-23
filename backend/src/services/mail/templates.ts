import { OTP_TTL_MINUTES, type ContactInput, type OtpPurpose } from '@mirhalgo/shared';
import { t, type EmailLabel, type Lang, type TranslationKey } from '../../i18n/index.js';
import { escapeHtml } from './escape.js';

/*
 * Branded bilingual email templates (spec 4.3): navy header, blue code box,
 * Arabic (RTL) first, then English. Email clients ignore external CSS, so the
 * brand colors (mirroring frontend/src/styles/tokens.css) are inlined here.
 * All copy comes from src/i18n/{ar,en}.json (MW_003 A1); this file holds layout only.
 * Only static copy is interpolated raw; all user content goes through escapeHtml.
 */
const COLORS = {
  navy: '#0B1B35',
  blue: '#2563EB',
  blue50: '#EFF5FF',
  body: '#334155',
  muted: '#64748B',
  onDarkMuted: '#CBD5E1',
  border: '#E2E8F0',
  page: '#F8FAFC',
  white: '#FFFFFF',
} as const;

const FONT = "'Cairo','Inter','Segoe UI',Tahoma,Arial,sans-serif";

export type MailContent = { subject: string; html: string; text: string };

type LocalizedBlock = { title: string; paragraphs: string[] };

/** The same block in both languages, Arabic first. */
const inBothLanguages = (
  build: (lang: Lang) => LocalizedBlock,
): [LocalizedBlock, LocalizedBlock] => [build('ar'), build('en')];

/** "English | Arabic", optionally followed by " — MirhalGo" when the text has no brand name. */
function bilingualSubject(key: TranslationKey, { brand = false } = {}): string {
  const subject = `${t('en', key)} | ${t('ar', key)}`;
  return brand ? `${subject} — ${t('en', 'email.brand')}` : subject;
}

/** Team-inbox field label, e.g. "Email / البريد الإلكتروني". */
const label = (key: EmailLabel) =>
  `${t('en', `email.labels.${key}`)} / ${t('ar', `email.labels.${key}`)}`;

function block(lang: Lang, { title, paragraphs }: LocalizedBlock): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:${COLORS.body};">${p}</p>`,
    )
    .join('');
  return `<div lang="${lang}" dir="${dir}" style="text-align:${align};">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:${COLORS.navy};">${title}</h1>${body}
    </div>`;
}

/** Card with the navy brand header and a small footer around `content`. */
function layout(content: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
          <tr><td style="background:${COLORS.navy};padding:20px 28px;text-align:center;">
            <span style="font-size:22px;font-weight:800;color:${COLORS.white};">${t('en', 'email.brand')}</span>
            <span style="font-size:16px;color:${COLORS.onDarkMuted};"> | ${t('ar', 'email.brand')}</span>
          </td></tr>
          <tr><td style="padding:28px;">${content}</td></tr>
          <tr><td style="padding:16px 28px;background:${COLORS.page};text-align:center;font-size:12px;line-height:18px;color:${COLORS.muted};">
            © ${new Date().getFullYear()} ${t('en', 'email.brand')}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const DIVIDER = `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:20px 0;" />`;

/** Arabic block, optional middle part (e.g. the code box), divider, English block. */
function bilingual(
  subject: string,
  ar: LocalizedBlock,
  en: LocalizedBlock,
  middle = '',
): MailContent {
  return {
    subject,
    html: layout(`${block('ar', ar)}${middle}${DIVIDER}${block('en', en)}`),
    text: [ar.title, ...ar.paragraphs, '', '———', '', en.title, ...en.paragraphs].join('\n'),
  };
}

function codeBox(code: string): string {
  return `<div style="margin:20px 0;padding:18px;background:${COLORS.blue50};border:2px solid ${COLORS.blue};border-radius:12px;text-align:center;">
      <span dir="ltr" style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:${COLORS.blue};">${code}</span>
    </div>`;
}

/** OTP email. The code is NEVER in the subject (spec 4.3). */
export function otpEmail(code: string, purpose: OtpPurpose): MailContent {
  const key = `email.otp.${purpose}` as const;
  const mail = bilingual(
    bilingualSubject(`${key}.subject`, { brand: true }),
    ...inBothLanguages((lang) => ({
      title: t(lang, `${key}.title`),
      paragraphs: [t(lang, `${key}.body`, { minutes: OTP_TTL_MINUTES }), t(lang, 'email.ignore')],
    })),
    codeBox(code),
  );
  return { ...mail, text: `${code}\n\n${mail.text}` };
}

/** "Someone tried to sign up with your email / phone": title, two paragraphs, ignore notice. */
function noticeEmail(key: 'email.accountExists' | 'email.phoneTaken'): MailContent {
  return bilingual(
    bilingualSubject(`${key}.subject`),
    ...inBothLanguages((lang) => ({
      title: t(lang, `${key}.title`),
      paragraphs: [t(lang, `${key}.intro`), t(lang, `${key}.action`), t(lang, 'email.ignore')],
    })),
  );
}

/** Sent instead of an OTP when someone signs up with an already verified email (no enumeration). */
export const accountExistsEmail = (): MailContent => noticeEmail('email.accountExists');

/** Sent when the phone used at signup belongs to another account (no enumeration). */
export const phoneTakenEmail = (): MailContent => noticeEmail('email.phoneTaken');

/** Label/value rows for the team inbox; values are escaped. */
function detailsTable(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([name, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:${COLORS.muted};white-space:nowrap;">${name}</td><td dir="auto" style="padding:6px 0;color:${COLORS.navy};font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" style="margin:16px 0;font-size:15px;">${cells}</table>`;
}

/** "New contact message / رسالة تواصل جديدة" heading of the team-inbox emails. */
const teamTitle = (key: TranslationKey) => `${t('en', key)} / ${t('ar', key)}`;

/** Contact form → team inbox (spec 3.5). Every user field is escaped. */
export function contactEmail(input: ContactInput): MailContent {
  const name = `${input.firstName} ${input.lastName}`;
  const rows: Array<[string, string]> = [
    [label('name'), name],
    [label('email'), input.email],
    [label('phone'), input.phone],
  ];

  return {
    subject: t('en', 'email.team.contactSubject', { name }),
    html: layout(`${block('en', { title: teamTitle('email.team.contactTitle'), paragraphs: [] })}
      ${detailsTable(rows)}
      <div dir="auto" style="padding:16px;background:${COLORS.page};border:1px solid ${COLORS.border};border-radius:12px;font-size:15px;line-height:24px;color:${COLORS.body};white-space:pre-wrap;">${escapeHtml(input.message)}</div>`),
    text: [...rows.map(([key, value]) => `${key}: ${value}`), '', input.message].join('\n'),
  };
}

// ── Company registration (MW_002) ─────────────────────────────────────────

function referenceBox(referenceNumber: string): string {
  return `<div style="margin:20px 0;padding:14px;background:${COLORS.blue50};border:2px solid ${COLORS.blue};border-radius:12px;text-align:center;">
      <span dir="ltr" style="font-family:Consolas,Menlo,monospace;font-size:22px;font-weight:800;letter-spacing:2px;color:${COLORS.blue};">${escapeHtml(referenceNumber)}</span>
    </div>`;
}

/** To the company after its email is verified: the application is now pending review. */
export function companyApplicationReceivedEmail({
  referenceNumber,
  legalName,
}: {
  referenceNumber: string;
  legalName: string;
}): MailContent {
  const subject = bilingualSubject('email.applicationReceived.subject', { brand: true });
  // `name` is HTML-escaped for the html part and raw for the plain-text part.
  const copy = (name: string) =>
    inBothLanguages((lang) => ({
      title: t(lang, 'email.applicationReceived.title'),
      paragraphs: [
        t(lang, 'email.applicationReceived.thanks', { name, reference: referenceNumber }),
        t(lang, 'email.applicationReceived.next'),
      ],
    }));
  const { html } = bilingual(
    subject,
    ...copy(escapeHtml(legalName)),
    referenceBox(referenceNumber),
  );
  const { text } = bilingual(subject, ...copy(legalName));
  return { subject, html, text };
}

/** Short notice to the team inbox (decision 12). Never contains documents or links to them. */
export function newCompanyApplicationEmail(details: {
  referenceNumber: string;
  legalName: string;
  email: string;
  /** e.g. "Giza (EG)" */
  region: string;
  activities: readonly string[];
}): MailContent {
  const rows: Array<[string, string]> = [
    [label('reference'), details.referenceNumber],
    [label('company'), details.legalName],
    [label('email'), details.email],
    [label('region'), details.region],
    [label('activities'), details.activities.join(', ')],
  ];
  return {
    subject: t('en', 'email.team.companySubject', { reference: details.referenceNumber }),
    html: layout(`${block('en', { title: teamTitle('email.team.companyTitle'), paragraphs: [t('en', 'email.team.companyNote')] })}
      ${detailsTable(rows)}`),
    text: rows.map(([key, value]) => `${key}: ${value}`).join('\n'),
  };
}
