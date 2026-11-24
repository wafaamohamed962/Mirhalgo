import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/middleware/errorHandler.js';

/*
 * Demo company seed (MW_004 A2/A3). The real shared schema and upload checks run; Supabase,
 * the account services and the RPCs are mocked, so this never touches a database.
 */

const PASSWORD = 'Demo!Pass2026';

type Profile = { id: string; email: string; role: string; email_verified_at: string | null };
const state = {
  profile: null as Profile | null,
  phoneOwner: null as Profile | null,
  application: null as { id: string; status: string } | null,
  company: null as { country_code: string; commercial_register_number: string } | null,
  legalTaken: false,
  approveError: null as Error | null,
};

const calls = {
  from: vi.fn(),
  rpc: vi.fn(),
  create: vi.fn(),
  deleteCompany: vi.fn(async () => true),
  confirmEmail: vi.fn(),
  setPassword: vi.fn(),
  location: vi.fn(),
};

vi.mock('../src/lib/supabase.js', () => ({
  db: {
    from: (table: string) => {
      calls.from(table);
      const result = () => ({
        data: table === 'company_applications' ? state.application : state.company,
        error: null,
      });
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => result(),
        maybeSingle: async () => result(),
      };
      return builder;
    },
    rpc: async (name: string, args: { p_to: string }) => {
      calls.rpc(name, args);
      if (state.approveError) return { data: null, error: state.approveError };
      if (state.application) state.application.status = args.p_to;
      return { data: args.p_to, error: null };
    },
  },
}));
vi.mock('../src/services/companies.js', () => ({
  assertLegalNumbersFree: async () => {
    if (state.legalTaken) throw new HttpError(409, 'COMPANY_ALREADY_REGISTERED', 'taken');
  },
  createRegistration: async (...args: unknown[]) => {
    calls.create(...args);
    state.application = { id: 'app-1', status: 'pending_verification' };
    return { ok: true, userId: 'co-1', reference: 'MG-C-2026-000777' };
  },
  deleteCompany: calls.deleteCompany,
}));
vi.mock('../src/services/users.js', () => ({
  findProfileByEmail: async () => state.profile,
  findProfileByPhone: async () => state.phoneOwner,
  confirmEmail: calls.confirmEmail,
  setPassword: calls.setPassword,
}));
vi.mock('../src/services/reference.js', () => ({ assertCompanyLocation: calls.location }));

const { DEMO_DEFAULTS, SeedError, demoDocuments, demoRegistration, parseSeedInput, runSeed } =
  await import('../src/services/demoCompany.js');

const env = { DEMO_COMPANY_PASSWORD: PASSWORD };
const input = (argv: string[] = ['--yes'], extra: Record<string, string> = {}) =>
  parseSeedInput(argv, { ...env, ...extra }, 'development');
const demoProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'co-1',
  email: DEMO_DEFAULTS.email,
  role: 'company',
  email_verified_at: '2026-11-24',
  ...overrides,
});
const asDemoCompany = () => {
  state.company = {
    country_code: 'EG',
    commercial_register_number: DEMO_DEFAULTS.commercialRegister,
  };
};

/** Every printed line, to check the password never appears. */
const printed: string[] = [];
async function run(seedInput = input()) {
  const lines = await runSeed(seedInput, 'projref');
  printed.push(...lines);
  return lines;
}
async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SeedError);
  printed.push((error as Error).message);
  return (error as Error).message;
}

beforeEach(() => {
  Object.assign(state, {
    profile: null,
    phoneOwner: null,
    application: null,
    company: null,
    legalTaken: false,
    approveError: null,
  });
  vi.clearAllMocks();
});

describe('parseSeedInput', () => {
  it('defaults: the spec email and the approved fake values; dry run unless --yes', () => {
    expect(parseSeedInput([], env, 'development')).toEqual({
      action: 'seed',
      write: false,
      resetPassword: false,
      email: 'demo.company@mirhalgo.com',
      phone: '+201000000001',
      commercialRegister: '9990000001',
      taxNumber: '999000001',
      password: PASSWORD,
    });
    expect(
      input(['--yes', '--reset-password'], { DEMO_COMPANY_EMAIL: 'demo@x.test' }),
    ).toMatchObject({ write: true, resetPassword: true, email: 'demo@x.test' });
  });

  it('needs DEMO_COMPANY_PASSWORD to seed (not to remove)', () => {
    expect(() => parseSeedInput(['--yes'], {}, 'development')).toThrow(/DEMO_COMPANY_PASSWORD/);
    expect(parseSeedInput(['--remove'], {}, 'development').action).toBe('remove');
  });

  it('refuses production unless --allow-production; rejects unknown options', () => {
    expect(() => parseSeedInput(['--yes'], env, 'production')).toThrow(/NODE_ENV=production/);
    expect(parseSeedInput(['--yes', '--allow-production'], env, 'production').write).toBe(true);
    expect(() => parseSeedInput(['--force'], env, 'development')).toThrow(/unknown option/);
  });
});

describe('demo data', () => {
  it('a valid registration: the spec company, EG / Alexandria, international shipping + customs', () => {
    const app = demoRegistration(input());
    expect(app).toMatchObject({
      legalName: 'أليكس إكسبريس للشحن الدولي واللوجستيات',
      country: 'EG',
      region: 'EG-ALX',
      activities: ['international'],
      international: { scope: 'both', modes: ['sea', 'air', 'land'] },
      commercialRegisterNumber: '9990000001',
      taxNumber: '999000001',
      password: PASSWORD,
    });
  });

  it('a weak password fails the sign-up policy, without printing it', () => {
    const weak = input(['--yes'], { DEMO_COMPANY_PASSWORD: 'abc123' });
    expect(() => demoRegistration(weak)).toThrow(/password policy/);
    expect(() => demoRegistration(weak)).not.toThrow(/abc123/);
  });

  it('two placeholder PDFs pass the real upload checks', async () => {
    const files = await demoDocuments();
    expect(files.map((f) => [f.type, f.mime])).toEqual([
      ['commercial_register', 'application/pdf'],
      ['tax_card', 'application/pdf'],
    ]);
  });
});

describe('runSeed', () => {
  it('dry run (no --yes): validates only, NEVER reads or writes the database', async () => {
    const lines = await run(input([]));
    expect(lines.at(-1)).toMatch(/dry run.*Nothing read or written; add --yes/);
    expect(lines[0]).toBe('target Supabase project: projref');
    expect(calls.from).not.toHaveBeenCalled();
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.location).not.toHaveBeenCalled();
  });

  it('new: created like a sign-up, email verified, pending_verification → pending_review → approved', async () => {
    const lines = await run();
    expect(calls.create).toHaveBeenCalledOnce();
    expect(calls.create.mock.calls[0]?.[0]).toMatchObject({
      email: DEMO_DEFAULTS.email,
      password: PASSWORD,
    });
    expect(calls.confirmEmail).toHaveBeenCalledWith('co-1');
    expect(
      calls.rpc.mock.calls.map(([name, args]) => [name, args.p_to, args.p_actor_type]),
    ).toEqual([
      ['transition_application_status', 'pending_review', 'system'],
      ['transition_application_status', 'approved', 'system'],
    ]);
    expect(lines.at(-1)).toBe(
      'created d***@mirhalgo.com: MG-C-2026-000777, email verified, approved.',
    );
  });

  it('new, a step fails after the account exists: the account and files are removed', async () => {
    state.approveError = new Error('rpc down');
    await expect(run()).rejects.toThrow('rpc down');
    expect(calls.deleteCompany).toHaveBeenCalledWith('co-1');
  });

  it('new: legal numbers or the phone already used → stops before creating anything', async () => {
    state.legalTaken = true;
    expect(await failure(run())).toMatch(/DEMO_COMPANY_CR/);
    state.legalTaken = false;
    state.phoneOwner = demoProfile({ id: 'someone', role: 'customer' });
    expect(await failure(run())).toMatch(/DEMO_COMPANY_PHONE/);
    expect(calls.create).not.toHaveBeenCalled();
  });

  it('rerun on the approved demo company: nothing changes; the password only with --reset-password', async () => {
    state.profile = demoProfile();
    state.application = { id: 'app-1', status: 'approved' };
    asDemoCompany();
    expect(await run()).toContain('already approved.');
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(calls.setPassword).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();

    expect(await run(input(['--yes', '--reset-password']))).toContain(
      'password reset from DEMO_COMPANY_PASSWORD.',
    );
    expect(calls.setPassword).toHaveBeenCalledWith('co-1', PASSWORD);
  });

  it('rerun on a pending demo company: approved; an unverified email gets verified', async () => {
    state.profile = demoProfile({ email_verified_at: null });
    state.application = { id: 'app-1', status: 'changes_requested' };
    asDemoCompany();
    expect(await run()).toContain('approved (was changes_requested).');
    expect(calls.confirmEmail).toHaveBeenCalledWith('co-1');
    expect(calls.rpc.mock.calls.map(([, args]) => args.p_to)).toEqual([
      'pending_review',
      'approved',
    ]);
  });

  it('never touches another account: a customer, another company, or a rejected demo', async () => {
    state.profile = demoProfile({ role: 'customer' });
    expect(await failure(run())).toMatch(/customer account: nothing changed/);

    state.profile = demoProfile();
    state.company = { country_code: 'EG', commercial_register_number: '123' };
    expect(await failure(run())).toMatch(/different company: nothing changed/);

    asDemoCompany();
    state.application = { id: 'app-1', status: 'rejected' };
    expect(await failure(run())).toMatch(/--remove/);
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(calls.setPassword).not.toHaveBeenCalled();
    expect(calls.confirmEmail).not.toHaveBeenCalled();
  });

  it('--remove: dry run, absent, the demo company (rows + files), never another account', async () => {
    const remove = (argv: string[]) => parseSeedInput(argv, {}, 'development');
    expect((await run(remove(['--remove']))).at(-1)).toMatch(/dry run: would remove/);
    expect(calls.deleteCompany).not.toHaveBeenCalled();

    expect((await run(remove(['--remove', '--yes']))).at(-1)).toMatch(/does not exist/);

    state.profile = demoProfile();
    asDemoCompany();
    expect((await run(remove(['--remove', '--yes']))).at(-1)).toMatch(
      /removed d\*\*\*@mirhalgo.com/,
    );
    expect(calls.deleteCompany).toHaveBeenCalledWith('co-1');

    calls.deleteCompany.mockClear();
    state.profile = demoProfile({ role: 'customer' });
    expect(await failure(run(remove(['--remove', '--yes'])))).toMatch(/nothing changed/);
    expect(calls.deleteCompany).not.toHaveBeenCalled();
  });

  it('nothing it printed contains the password or the full email', () => {
    expect(printed.length).toBeGreaterThan(10);
    for (const line of printed) {
      expect(line).not.toContain(PASSWORD);
      expect(line).not.toContain(DEMO_DEFAULTS.email);
    }
  });
});
