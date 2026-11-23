import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TERMS_VERSION,
  companyRegistrationSchema,
  type CompanyRegistration,
} from '@mirhalgo/shared';

/*
 * Company registration service (MW_002 A3): duplicate rules (decisions 1 + 2), all-or-nothing
 * rollback, the RPC payload, and verification. Supabase, storage, mail and OTP are mocked.
 */

type Profile = { id: string; email: string; role: string; email_verified_at: string | null };

const state = {
  byEmail: null as Profile | null,
  byPhone: null as Profile | null,
  legalRows: [] as Array<{ id: string }>,
  application: null as { id?: string; status: string; reference_number?: string } | null,
  documents: [] as Array<{ storage_bucket: string; storage_path: string }>,
  createUserError: null as null | { code: string },
  uploadError: null as Error | null,
  rpcError: null as null | { code?: string; message: string },
  removeOk: true,
  locationError: null as Error | null,
};

const calls = {
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  issueOtp: vi.fn(),
  eq: vi.fn(),
  mail: {
    accountExists: vi.fn(),
    phoneTaken: vi.fn(),
    companyApplicationReceived: vi.fn(),
    newCompanyApplication: vi.fn(),
  },
};

/** Thenable query builder returning `result(columns)` for any chain of filters. */
function query(result: (columns: string) => unknown) {
  let columns = '';
  const builder: Record<string, unknown> = {};
  builder.or = () => builder;
  builder.eq = (column: string, value: unknown) => {
    calls.eq(column, value);
    return builder;
  };
  builder.select = (cols: string) => {
    columns = cols;
    return builder;
  };
  builder.maybeSingle = () => Promise.resolve(result(columns));
  builder.single = () => Promise.resolve(result(columns));
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result(columns)).then(resolve);
  return builder;
}

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    auth: {
      admin: {
        createUser: async (args: unknown) => {
          calls.createUser(args);
          return state.createUserError
            ? { data: null, error: state.createUserError }
            : { data: { user: { id: 'new-user' } }, error: null };
        },
      },
    },
    from: (table: string) =>
      query((columns) => {
        if (table === 'companies')
          return {
            data:
              columns === 'id'
                ? state.legalRows // uniqueness pre-check
                : { legal_name: 'Nile & Co', region_id: 'EG-GZ', activities: ['china'] },
            error: null,
          };
        if (table === 'company_applications') return { data: state.application, error: null };
        if (table === 'company_documents') return { data: state.documents, error: null };
        throw new Error(`unexpected table ${table}`);
      }),
    rpc: (name: string, args: unknown) => {
      calls.rpc(name, args);
      if (name === 'create_company_registration')
        return {
          single: async () =>
            state.rpcError
              ? { data: null, error: state.rpcError }
              : {
                  data: { application_id: 'app-1', reference_number: 'MG-C-2026-000007' },
                  error: null,
                },
        };
      if (name === 'transition_application_status')
        return Promise.resolve({ data: 'pending_review', error: null });
      throw new Error(`unexpected rpc ${name}`);
    },
  },
}));
vi.mock('../src/services/users.js', () => ({
  UNIQUE_VIOLATION: '23505',
  findProfileByEmail: async () => state.byEmail,
  findProfileByPhone: async () => state.byPhone,
  deleteUser: async (id: string) => calls.deleteUser(id),
}));
vi.mock('../src/services/storage.js', () => ({
  uploadCompanyFiles: async (
    companyId: string,
    files: Array<{ type: string; extension: string }>,
  ) => {
    calls.upload(companyId);
    if (state.uploadError) throw state.uploadError;
    return files.map((file, i) => ({
      bucket: file.type === 'logo' ? 'company-logos' : 'company-documents',
      path: `${companyId}/uuid-${i}.${file.extension}`,
      file,
    }));
  },
  removeFiles: async (files: unknown) => {
    calls.remove(files);
    return state.removeOk;
  },
}));
vi.mock('../src/services/companyFiles.js', () => ({
  prepareFiles: async () => [
    {
      type: 'commercial_register',
      mime: 'application/pdf',
      extension: 'pdf',
      originalName: 'cr.pdf',
      size: 10,
      buffer: Buffer.from(''),
    },
    {
      type: 'tax_card',
      mime: 'image/png',
      extension: 'png',
      originalName: 'tax.png',
      size: 20,
      buffer: Buffer.from(''),
    },
  ],
}));
vi.mock('../src/services/reference.js', () => ({
  assertCompanyLocation: async () => {
    if (state.locationError) throw state.locationError;
  },
  regionLabel: async (id: string) => (id === 'EG-GZ' ? 'Giza (EG)' : id),
}));
vi.mock('../src/services/otp.js', () => ({
  otpSentResult: (email: string) => ({ email, cooldownSeconds: 60 }),
  issueOtp: async (args: unknown) => calls.issueOtp(args),
}));
vi.mock('../src/services/mail/index.js', () => ({
  assertMailConfigured: () => {},
  mail: calls.mail,
}));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const { registerCompany, completeCompanyVerification, cleanupExpiredRegistrations } =
  await import('../src/services/companies.js');

const app: CompanyRegistration = companyRegistrationSchema.parse({
  legalName: 'Nile & Co',
  representativeName: 'Ahmed Hassan',
  representativeTitle: 'Owner',
  email: 'ops@nile.com',
  phone: '+201012345678',
  whatsappSameAsMobile: true,
  country: 'EG',
  region: 'EG-GZ',
  city: 'Nasr City',
  street: '12 Abbas St',
  website: 'nile.com',
  password: 'Str0ng!pass',
  confirmPassword: 'Str0ng!pass',
  activities: ['china'],
  china: { sites: ['shein'], services: ['consolidation'] },
  yearsInBusiness: '5',
  commercialRegisterNumber: '123',
  taxNumber: '123456789',
  confirmAccuracy: true,
  acceptTerms: true,
  termsVersion: TERMS_VERSION,
});
const ctx = { ip: '197.1.1.1', userAgent: 'Vitest' };
const NEUTRAL = { email: 'ops@nile.com', cooldownSeconds: 60 };

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
}

beforeEach(() => {
  Object.assign(state, {
    byEmail: null,
    byPhone: null,
    legalRows: [],
    application: null,
    documents: [],
    createUserError: null,
    uploadError: null,
    rpcError: null,
    removeOk: true,
    locationError: null,
  });
  vi.clearAllMocks();
  calls.deleteUser.mockReset();
  calls.remove.mockReset();
  for (const fn of Object.values(calls.mail)) fn.mockClear();
});

describe('registerCompany', () => {
  it('creates the company user, uploads, calls the RPC with snake_case rows and sends the OTP', async () => {
    expect(await registerCompany(app, {}, ctx)).toEqual(NEUTRAL);
    expect(calls.createUser).toHaveBeenCalledWith({
      email: 'ops@nile.com',
      password: 'Str0ng!pass',
      email_confirm: false,
      app_metadata: { role: 'company' },
    });
    const [name, args] = calls.rpc.mock.calls[0]!;
    expect(name).toBe('create_company_registration');
    expect(args).toMatchObject({
      p_user_id: 'new-user',
      p_email: 'ops@nile.com',
      p_phone: '+201012345678',
      p_company: {
        legal_name: 'Nile & Co',
        country_code: 'EG',
        region_id: 'EG-GZ',
        whatsapp: '+201012345678',
        website: 'https://nile.com',
        activities: ['china'],
        years_in_business: 5,
        tax_number: '123456789',
        other_activity: null,
      },
      p_services: {
        china_sites: ['shein'],
        international_modes: [],
        international_scope: null,
        domestic_all_regions: false,
      },
      p_domestic_regions: [],
      p_documents: [
        {
          type: 'commercial_register',
          storage_bucket: 'company-documents',
          storage_path: 'new-user/uuid-0.pdf',
          original_name: 'cr.pdf',
          mime_type: 'application/pdf',
          size_bytes: 10,
        },
        {
          type: 'tax_card',
          storage_bucket: 'company-documents',
          storage_path: 'new-user/uuid-1.png',
          mime_type: 'image/png',
          size_bytes: 20,
        },
      ],
      p_consent: { terms_version: TERMS_VERSION, submit_ip: '197.1.1.1', user_agent: 'Vitest' },
    });
    expect(JSON.stringify(args)).not.toContain('Str0ng!pass'); // never stored in our tables
    expect(calls.issueOtp).toHaveBeenCalledWith({
      userId: 'new-user',
      email: 'ops@nile.com',
      purpose: 'signup',
      ip: '197.1.1.1',
    });
  });

  it('verified email → "account exists" email, neutral, nothing created', async () => {
    state.byEmail = {
      id: 'u1',
      email: 'ops@nile.com',
      role: 'customer',
      email_verified_at: '2026-11-20',
    };
    expect(await registerCompany(app, {}, ctx)).toEqual(NEUTRAL);
    expect(calls.mail.accountExists).toHaveBeenCalledWith('ops@nile.com');
    expect(calls.createUser).not.toHaveBeenCalled();
  });

  it('unverified CUSTOMER with this email → neutral, nothing changed (decision 2)', async () => {
    state.byEmail = { id: 'c1', email: 'ops@nile.com', role: 'customer', email_verified_at: null };
    expect(await registerCompany(app, {}, ctx)).toEqual(NEUTRAL);
    expect(calls.createUser).not.toHaveBeenCalled();
    expect(calls.deleteUser).not.toHaveBeenCalled();
    expect(calls.issueOtp).not.toHaveBeenCalled();
  });

  it('unverified company application → old files + user deleted, new one created (decision 2)', async () => {
    state.byEmail = { id: 'old', email: 'ops@nile.com', role: 'company', email_verified_at: null };
    state.byPhone = state.byEmail; // the same applicant may reuse their phone
    state.application = { status: 'pending_verification' };
    state.documents = [{ storage_bucket: 'company-documents', storage_path: 'old/a.pdf' }];
    state.legalRows = [{ id: 'old' }]; // its own legal numbers do not count as duplicates
    expect(await registerCompany(app, {}, ctx)).toEqual(NEUTRAL);
    expect(calls.remove).toHaveBeenCalledWith([{ bucket: 'company-documents', path: 'old/a.pdf' }]);
    expect(calls.deleteUser).toHaveBeenCalledWith('old');
    expect(calls.createUser).toHaveBeenCalled();
  });

  it('keeps the old application if its files cannot be removed', async () => {
    state.byEmail = { id: 'old', email: 'ops@nile.com', role: 'company', email_verified_at: null };
    state.application = { status: 'pending_verification' };
    state.removeOk = false;
    expect(await code(registerCompany(app, {}, ctx))).toMatch(/could not remove/);
    expect(calls.deleteUser).not.toHaveBeenCalled();
    expect(calls.createUser).not.toHaveBeenCalled();
  });

  it('unknown country / region (checked against the reference tables) → 400 before anything else', async () => {
    const { HttpError } = await import('../src/middleware/errorHandler.js');
    state.locationError = new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');
    expect(await code(registerCompany(app, {}, ctx))).toBe('VALIDATION_ERROR');
    expect(calls.createUser).not.toHaveBeenCalled();
    expect(calls.mail.accountExists).not.toHaveBeenCalled();
  });

  it('checks the legal numbers within the company country only (MW_003)', async () => {
    await registerCompany(app, {}, ctx);
    expect(calls.eq).toHaveBeenCalledWith('country_code', 'EG');
  });

  it('duplicate commercial register / tax number → 409 COMPANY_ALREADY_REGISTERED (decision 1)', async () => {
    state.legalRows = [{ id: 'someone-else' }];
    expect(await code(registerCompany(app, {}, ctx))).toBe('COMPANY_ALREADY_REGISTERED');
    expect(calls.createUser).not.toHaveBeenCalled();
  });

  it('phone used by another account → "phone taken" email, neutral, nothing created', async () => {
    state.byPhone = { id: 'other', email: 'x@y.com', role: 'customer', email_verified_at: null };
    expect(await registerCompany(app, {}, ctx)).toEqual(NEUTRAL);
    expect(calls.mail.phoneTaken).toHaveBeenCalledWith('ops@nile.com');
    expect(calls.createUser).not.toHaveBeenCalled();
  });

  it('race on the email at createUser → neutral, nothing else', async () => {
    state.createUserError = { code: 'email_exists' };
    expect(await registerCompany(app, {}, ctx)).toEqual(NEUTRAL);
    expect(calls.upload).not.toHaveBeenCalled();
  });

  it.each([
    [
      'tax number race',
      'duplicate key value violates unique constraint "companies_tax_number_key"',
      'COMPANY_ALREADY_REGISTERED',
    ],
    [
      'phone race',
      'duplicate key value violates unique constraint "profiles_phone_key"',
      'NO_ERROR',
    ],
  ])('RPC unique violation (%s) → files + user rolled back', async (_name, message, expected) => {
    state.rpcError = { code: '23505', message };
    expect(await code(registerCompany(app, {}, ctx))).toBe(expected);
    expect(calls.remove).toHaveBeenCalledWith([
      expect.objectContaining({ bucket: 'company-documents', path: 'new-user/uuid-0.pdf' }),
      expect.objectContaining({ path: 'new-user/uuid-1.png' }),
    ]);
    expect(calls.deleteUser).toHaveBeenCalledWith('new-user');
    expect(calls.issueOtp).not.toHaveBeenCalled();
  });

  it('any RPC failure → rollback and the original error is rethrown', async () => {
    state.rpcError = { code: '23514', message: 'check constraint' };
    calls.deleteUser.mockRejectedValueOnce(new Error('auth down')); // rollback problems never mask it
    expect(await code(registerCompany(app, {}, ctx))).toBe('23514');
    expect(calls.remove).toHaveBeenCalled();
  });

  it('upload failure → the auth user is deleted', async () => {
    state.uploadError = new Error('storage down');
    expect(await code(registerCompany(app, {}, ctx))).toBe('storage down');
    expect(calls.deleteUser).toHaveBeenCalledWith('new-user');
    expect(calls.rpc).not.toHaveBeenCalled();
  });
});

describe('completeCompanyVerification', () => {
  it('moves pending_verification → pending_review as the company and sends both emails', async () => {
    state.application = {
      id: 'app-1',
      status: 'pending_verification',
      reference_number: 'MG-C-2026-000007',
    };
    const result = await completeCompanyVerification('co-1', 'ops@nile.com', { ip: '1.1.1.1' });
    expect(result).toEqual({ referenceNumber: 'MG-C-2026-000007', status: 'pending_review' });
    expect(calls.rpc).toHaveBeenCalledWith('transition_application_status', {
      p_application_id: 'app-1',
      p_to: 'pending_review',
      p_actor_type: 'company',
      p_actor_id: 'co-1',
    });
    expect(calls.mail.companyApplicationReceived).toHaveBeenCalledWith('ops@nile.com', {
      referenceNumber: 'MG-C-2026-000007',
      legalName: 'Nile & Co',
    });
    expect(calls.mail.newCompanyApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceNumber: 'MG-C-2026-000007',
        email: 'ops@nile.com',
        region: 'Giza (EG)',
      }),
    );
  });

  it('is idempotent: an application already in review is not moved or re-emailed', async () => {
    state.application = {
      id: 'app-1',
      status: 'pending_review',
      reference_number: 'MG-C-2026-000007',
    };
    expect(await completeCompanyVerification('co-1', 'ops@nile.com', {})).toEqual({
      referenceNumber: 'MG-C-2026-000007',
      status: 'pending_review',
    });
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(calls.mail.companyApplicationReceived).not.toHaveBeenCalled();
  });

  it('an email failure does not fail the verification', async () => {
    state.application = {
      id: 'app-1',
      status: 'pending_verification',
      reference_number: 'MG-C-2026-000007',
    };
    calls.mail.companyApplicationReceived.mockRejectedValueOnce(new Error('smtp'));
    await expect(completeCompanyVerification('co-1', 'ops@nile.com', {})).resolves.toMatchObject({
      status: 'pending_review',
    });
  });
});

describe('cleanupExpiredRegistrations', () => {
  it('deletes files then the user, and skips users whose files could not be removed', async () => {
    const rows = [
      { user_id: 'a', documents: [{ bucket: 'company-documents', path: 'a/1.pdf' }] },
      { user_id: 'b', documents: [{ bucket: 'company-documents', path: 'b/1.pdf' }] },
    ];
    const { db } = await import('../src/lib/supabase.js');
    const rpc = vi.spyOn(db, 'rpc').mockResolvedValueOnce({ data: rows, error: null } as never);
    calls.remove.mockImplementation((files: Array<{ path: string }>) => {
      state.removeOk = files[0]!.path !== 'b/1.pdf';
    });
    expect(await cleanupExpiredRegistrations()).toBe(1);
    expect(calls.deleteUser.mock.calls).toEqual([['a']]);
    rpc.mockRestore();
  });
});
