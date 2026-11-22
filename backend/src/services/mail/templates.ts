import { OTP_TTL_MINUTES, type ContactInput, type OtpPurpose } from '@mirhalgo/shared';
import { escapeHtml } from './escape.js';

/*
 * Branded bilingual email templates (spec 4.3): navy header, blue code box,
 * Arabic (RTL) first, then English. Email clients ignore external CSS, so the
 * brand colors (mirroring frontend/src/styles/tokens.css) are inlined here.
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

function block(lang: 'ar' | 'en', { title, paragraphs }: LocalizedBlock): string {
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
            <span style="font-size:22px;font-weight:800;color:${COLORS.white};">MirhalGo</span>
            <span style="font-size:16px;color:${COLORS.onDarkMuted};"> | مرحال جو</span>
          </td></tr>
          <tr><td style="padding:28px;">${content}</td></tr>
          <tr><td style="padding:16px 28px;background:${COLORS.page};text-align:center;font-size:12px;line-height:18px;color:${COLORS.muted};">
            © ${new Date().getFullYear()} MirhalGo
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

const IGNORE = {
  ar: 'لو مطلبتش ده، تجاهل الإيميل ده.',
  en: "If you didn't request this, ignore this email.",
};

const OTP_COPY: Record<OtpPurpose, { subject: string; ar: LocalizedBlock; en: LocalizedBlock }> = {
  signup: {
    subject: 'Verify your email | تأكيد بريدك الإلكتروني — MirhalGo',
    ar: {
      title: 'كود تأكيد البريد الإلكتروني',
      paragraphs: [
        `استخدم الكود ده لتأكيد بريدك في مرحال جو. الكود صالح لمدة ${OTP_TTL_MINUTES} دقائق.`,
        IGNORE.ar,
      ],
    },
    en: {
      title: 'Your verification code',
      paragraphs: [
        `Use this code to verify your email on MirhalGo. It expires in ${OTP_TTL_MINUTES} minutes.`,
        IGNORE.en,
      ],
    },
  },
  reset_password: {
    subject: 'Reset your password | استعادة كلمة المرور — MirhalGo',
    ar: {
      title: 'كود استعادة كلمة المرور',
      paragraphs: [
        `استخدم الكود ده لتغيير كلمة المرور في مرحال جو. الكود صالح لمدة ${OTP_TTL_MINUTES} دقائق.`,
        IGNORE.ar,
      ],
    },
    en: {
      title: 'Your password reset code',
      paragraphs: [
        `Use this code to reset your MirhalGo password. It expires in ${OTP_TTL_MINUTES} minutes.`,
        IGNORE.en,
      ],
    },
  },
};

/** OTP email. The code is NEVER in the subject (spec 4.3). */
export function otpEmail(code: string, purpose: OtpPurpose): MailContent {
  const { subject, ar, en } = OTP_COPY[purpose];
  const mail = bilingual(subject, ar, en, codeBox(code));
  return { ...mail, text: `${code}\n\n${mail.text}` };
}

/** Sent instead of an OTP when someone signs up with an already verified email (no enumeration). */
export function accountExistsEmail(): MailContent {
  return bilingual(
    'You already have a MirhalGo account | عندك حساب بالفعل في مرحال جو',
    {
      title: 'عندك حساب بالفعل',
      paragraphs: [
        'حد حاول يعمل حساب جديد في مرحال جو بالبريد ده، بس البريد ده متسجل عندنا بالفعل.',
        'تقدر تسجّل الدخول، ولو نسيت كلمة المرور استخدم "نسيت كلمة المرور؟" في صفحة تسجيل الدخول.',
        IGNORE.ar,
      ],
    },
    {
      title: 'You already have an account',
      paragraphs: [
        'Someone tried to create a new MirhalGo account with this email, but it is already registered.',
        'You can log in, or use "Forgot password?" on the login page if you don\'t remember your password.',
        IGNORE.en,
      ],
    },
  );
}

/** Sent when the phone used at signup belongs to another account (no enumeration). */
export function phoneTakenEmail(): MailContent {
  return bilingual(
    'About your MirhalGo sign up | بخصوص تسجيلك في مرحال جو',
    {
      title: 'بخصوص تسجيلك في مرحال جو',
      paragraphs: [
        'معرفناش نكمّل إنشاء حسابك لأن رقم الهاتف اللي استخدمته متسجل بحساب تاني.',
        'لو الرقم ده بتاعك، سجّل الدخول بيه أو استخدم "نسيت كلمة المرور؟". غير كده، سجّل برقم تاني.',
        IGNORE.ar,
      ],
    },
    {
      title: 'About your MirhalGo sign up',
      paragraphs: [
        "We couldn't finish creating your account because the phone number you used is already registered to another account.",
        'If this number is yours, log in with it or use "Forgot password?". Otherwise, sign up with a different number.',
        IGNORE.en,
      ],
    },
  );
}

/** Contact form → team inbox (spec 3.5). Every user field is escaped. */
export function contactEmail(input: ContactInput): MailContent {
  const name = `${input.firstName} ${input.lastName}`;
  const rows: Array<[string, string]> = [
    ['Name / الاسم', name],
    ['Email / البريد', input.email],
    ['Phone / الهاتف', input.phone],
  ];
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:${COLORS.muted};white-space:nowrap;">${label}</td><td dir="auto" style="padding:6px 0;color:${COLORS.navy};font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  return {
    subject: `New contact message — ${name}`,
    html: layout(`${block('en', { title: 'New contact message / رسالة تواصل جديدة', paragraphs: [] })}
      <table role="presentation" style="margin:16px 0;font-size:15px;">${table}</table>
      <div dir="auto" style="padding:16px;background:${COLORS.page};border:1px solid ${COLORS.border};border-radius:12px;font-size:15px;line-height:24px;color:${COLORS.body};white-space:pre-wrap;">${escapeHtml(input.message)}</div>`),
    text: [...rows.map(([label, value]) => `${label}: ${value}`), '', input.message].join('\n'),
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
  const subject = 'Application received | تم استلام طلبك — MirhalGo';
  // `name` is HTML-escaped for the html part and raw for the plain-text part.
  const copy = (name: string): [LocalizedBlock, LocalizedBlock] => [
    {
      title: 'استلمنا طلب انضمام شركتك',
      paragraphs: [
        `شكراً لتسجيل "${name}" في مرحال جو. رقم الطلب: ${referenceNumber}`,
        'فريقنا هيراجع طلبك خلال 48 ساعة، وهنبعتلك إيميل بالنتيجة.',
      ],
    },
    {
      title: 'We received your application',
      paragraphs: [
        `Thank you for registering "${name}" on MirhalGo. Your reference number: ${referenceNumber}`,
        "Our team will review your application within 48 hours. We'll email you with the result.",
      ],
    },
  ];
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
  governorate: string;
  activities: readonly string[];
}): MailContent {
  const rows: Array<[string, string]> = [
    ['Reference / رقم الطلب', details.referenceNumber],
    ['Company / الشركة', details.legalName],
    ['Email / البريد', details.email],
    ['Governorate / المحافظة', details.governorate],
    ['Activities / الأنشطة', details.activities.join(', ')],
  ];
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:${COLORS.muted};white-space:nowrap;">${label}</td><td dir="auto" style="padding:6px 0;color:${COLORS.navy};font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return {
    subject: `New company application — ${details.referenceNumber}`,
    html: layout(`${block('en', { title: 'New company application / طلب انضمام شركة جديد', paragraphs: ['Pending review. Documents are only available in the admin panel.'] })}
      <table role="presentation" style="margin:16px 0;font-size:15px;">${table}</table>`),
    text: rows.map(([label, value]) => `${label}: ${value}`).join('\n'),
  };
}
