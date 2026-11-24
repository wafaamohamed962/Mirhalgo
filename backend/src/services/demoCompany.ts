import {
  TERMS_VERSION,
  companyRegistrationSchema,
  type ApplicationStatus,
  type CompanyRegistration,
} from '@mirhalgo/shared';
import demo from '../seed/demoCompany.json' with { type: 'json' };
import { maskEmail } from '../lib/logger.js';
import { db } from '../lib/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import { prepareFiles, type IncomingFile, type PreparedFile } from './companyFiles.js';
import { assertLegalNumbersFree, createRegistration, deleteCompany } from './companies.js';
import { assertCompanyLocation } from './reference.js';
import { confirmEmail, findProfileByEmail, findProfileByPhone, setPassword } from './users.js';

/*
 * The demo company account (MW_004 A2): role `company`, email verified, application
 * `approved`, a complete profile. Built with the SAME code as a real registration
 * (shared schema → createRegistration → the create_company_registration RPC → status
 * transitions), so every DB rule applies. No email is sent. The password comes from
 * DEMO_COMPANY_PASSWORD and is never printed.
 */

/** Clearly fake, unique-constrained values (plan Q3, approved): overridable by env. */
export const DEMO_DEFAULTS = {
  email: 'demo.company@mirhalgo.com',
  phone: '+201000000001',
  commercialRegister: '9990000001',
  taxNumber: '999000001',
} as const;

const STATUS_NOTE = 'demo seed (MW_004)';
const DEMO_COUNTRY = 'EG';

/** A problem the operator must fix; printed as one line, nothing secret in it. */
export class SeedError extends Error {}

export type SeedInput = {
  action: 'seed' | 'remove';
  /** false = dry run: validate only, never touch the database. */
  write: boolean;
  resetPassword: boolean;
  email: string;
  phone: string;
  commercialRegister: string;
  taxNumber: string;
  /** Required to seed; never logged. */
  password: string | null;
};

const FLAGS = ['--yes', '--allow-production', '--reset-password', '--remove'] as const;

/** Command-line flags + env → what to do. Refuses production unless explicitly allowed. */
export function parseSeedInput(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  nodeEnv: string,
): SeedInput {
  const unknown = argv.filter((arg) => !(FLAGS as readonly string[]).includes(arg));
  if (unknown.length) throw new SeedError(`unknown option(s): ${unknown.join(' ')}`);
  const has = (flag: (typeof FLAGS)[number]) => argv.includes(flag);

  if (nodeEnv === 'production' && !has('--allow-production')) {
    throw new SeedError(
      'refusing to run with NODE_ENV=production (development / staging only). ' +
        'Production needs the Team Lead approval and --allow-production.',
    );
  }
  const action = has('--remove') ? 'remove' : 'seed';
  const password = env.DEMO_COMPANY_PASSWORD?.length ? env.DEMO_COMPANY_PASSWORD : null;
  if (action === 'seed' && !password) {
    throw new SeedError('DEMO_COMPANY_PASSWORD is not set (backend/.env).');
  }
  return {
    action,
    write: has('--yes'),
    resetPassword: has('--reset-password'),
    email: env.DEMO_COMPANY_EMAIL || DEMO_DEFAULTS.email,
    phone: env.DEMO_COMPANY_PHONE || DEMO_DEFAULTS.phone,
    commercialRegister: env.DEMO_COMPANY_CR || DEMO_DEFAULTS.commercialRegister,
    taxNumber: env.DEMO_COMPANY_TAX || DEMO_DEFAULTS.taxNumber,
    password,
  };
}

/**
 * The registration, validated by the shared schema like a real sign-up (password policy,
 * phone, Egyptian legal-number rules). Errors name the field only, never its value.
 */
export function demoRegistration(input: SeedInput): CompanyRegistration {
  const password = input.password ?? '';
  const parsed = companyRegistrationSchema.safeParse({
    ...demo,
    email: input.email,
    phone: input.phone,
    whatsappSameAsMobile: true,
    country: DEMO_COUNTRY,
    region: 'EG-ALX',
    password,
    confirmPassword: password,
    activities: ['international'],
    international: {
      modes: ['sea', 'air', 'land'],
      scope: 'both',
      countries: ['SA', 'AE', 'CN', 'TR', 'GB'],
      regions: ['gulf', 'europe', 'china'],
    },
    yearsInBusiness: '12',
    commercialRegisterNumber: input.commercialRegister,
    taxNumber: input.taxNumber,
    confirmAccuracy: true,
    acceptTerms: true,
    termsVersion: TERMS_VERSION,
  });
  if (parsed.success) return parsed.data;

  const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  if (fields.includes('password')) {
    throw new SeedError('DEMO_COMPANY_PASSWORD does not meet the sign-up password policy.');
  }
  throw new SeedError(`invalid demo company data: ${fields.join(', ')}`);
}

/** A minimal valid PDF (checked by its signature like any upload), one per required document. */
function placeholderPdf(name: string): IncomingFile {
  const buffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  );
  return { buffer, originalname: `${name}.pdf`, size: buffer.length };
}

export function demoDocuments(): Promise<PreparedFile[]> {
  return prepareFiles({
    commercial_register: [placeholderPdf('demo-commercial-register')],
    tax_card: [placeholderPdf('demo-tax-card')],
  });
}

/** The allowed transitions (MW_002 A2 trigger) from each status to `approved`. */
const TO_APPROVED: Record<ApplicationStatus, ApplicationStatus[] | null> = {
  pending_verification: ['pending_review', 'approved'],
  pending_review: ['approved'],
  changes_requested: ['pending_review', 'approved'],
  approved: [],
  rejected: null, // final: remove and seed again
};

/** Moves the application to `approved` (actor `system`), the way the admin will later. */
async function approve(userId: string): Promise<ApplicationStatus> {
  const { data: application, error } = await db
    .from('company_applications')
    .select('id, status')
    .eq('company_id', userId)
    .single();
  if (error) throw error;
  const before = application.status;
  const steps = TO_APPROVED[before];
  if (!steps) {
    throw new SeedError('the demo application is rejected: run with --remove, then seed again.');
  }
  for (const to of steps) {
    const moved = await db.rpc('transition_application_status', {
      p_application_id: application.id,
      p_to: to,
      p_actor_type: 'system',
      p_note: STATUS_NOTE,
    });
    if (moved.error) throw moved.error;
  }
  return before;
}

/** The existing account must be THIS demo company; anything else is never touched. */
async function assertIsDemoCompany(
  profile: { id: string; role: string },
  { email, commercialRegister }: Pick<SeedInput, 'email' | 'commercialRegister'>,
) {
  if (profile.role !== 'company') {
    throw new SeedError(
      `${maskEmail(email)} belongs to a ${profile.role} account: nothing changed.`,
    );
  }
  const { data, error } = await db
    .from('companies')
    .select('country_code, commercial_register_number')
    .eq('id', profile.id)
    .maybeSingle();
  if (error) throw error;
  if (
    data?.country_code !== DEMO_COUNTRY ||
    data.commercial_register_number !== commercialRegister
  ) {
    throw new SeedError(`${maskEmail(email)} is a different company: nothing changed.`);
  }
}

async function createDemoCompany(app: CompanyRegistration): Promise<string[]> {
  await assertCompanyLocation(app);
  await assertLegalNumbersFree(app).catch((error: unknown) => {
    if (error instanceof HttpError) {
      throw new SeedError(
        'the commercial register or tax number is used by another company: set DEMO_COMPANY_CR / DEMO_COMPANY_TAX.',
      );
    }
    throw error;
  });
  if (await findProfileByPhone(app.phone)) {
    throw new SeedError('the phone is used by another account: set DEMO_COMPANY_PHONE.');
  }

  const result = await createRegistration(app, await demoDocuments(), {
    userAgent: 'seed:demo-company',
  });
  if (!result.ok) throw new SeedError(`could not create the account (${result.conflict} taken).`);
  try {
    await confirmEmail(result.userId);
    await approve(result.userId);
  } catch (error) {
    await deleteCompany(result.userId).catch(() => false); // all-or-nothing, like a sign-up
    throw error;
  }
  return [`created ${maskEmail(app.email)}: ${result.reference}, email verified, approved.`];
}

async function updateDemoCompany(
  profile: { id: string; role: string; email_verified_at: string | null },
  app: CompanyRegistration,
  resetPassword: boolean,
): Promise<string[]> {
  await assertIsDemoCompany(profile, {
    email: app.email,
    commercialRegister: app.commercialRegisterNumber,
  });
  const lines = [`${maskEmail(app.email)} already exists (the demo company).`];
  if (!profile.email_verified_at) {
    await confirmEmail(profile.id);
    lines.push('email verified.');
  }
  const before = await approve(profile.id);
  lines.push(before === 'approved' ? 'already approved.' : `approved (was ${before}).`);
  if (resetPassword) {
    await setPassword(profile.id, app.password);
    lines.push('password reset from DEMO_COMPANY_PASSWORD.');
  } else {
    lines.push('password unchanged (use --reset-password to set it from DEMO_COMPANY_PASSWORD).');
  }
  return lines;
}

async function removeDemoCompany(input: SeedInput): Promise<string[]> {
  const profile = await findProfileByEmail(input.email);
  if (!profile) return [`${maskEmail(input.email)} does not exist: nothing to remove.`];
  await assertIsDemoCompany(profile, input);
  if (!(await deleteCompany(profile.id))) {
    throw new SeedError('the files could not be removed (account kept): run --remove again.');
  }
  return [`removed ${maskEmail(input.email)} with its rows and files.`];
}

/**
 * `npm run seed:demo-company -w backend`. Without --yes it is a dry run: the inputs are
 * validated and NOTHING is read from or written to the database.
 */
export async function runSeed(input: SeedInput, projectRef: string): Promise<string[]> {
  const lines = [`target Supabase project: ${projectRef}`];
  if (input.action === 'remove') {
    if (!input.write) {
      return [
        ...lines,
        `dry run: would remove ${maskEmail(input.email)}. Nothing changed; add --yes.`,
      ];
    }
    return [...lines, ...(await removeDemoCompany(input))];
  }

  const app = demoRegistration(input);
  await demoDocuments(); // the placeholder files pass the upload checks
  if (!input.write) {
    return [
      ...lines,
      `dry run: ${maskEmail(app.email)} is valid (approved company, EG / Alexandria). ` +
        'Nothing read or written; add --yes.',
    ];
  }
  const existing = await findProfileByEmail(app.email);
  return [
    ...lines,
    ...(existing
      ? await updateDemoCompany(existing, app, input.resetPassword)
      : await createDemoCompany(app)),
  ];
}
