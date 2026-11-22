import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The company wizard (MW_002 A1–A2) with the API call mocked. */

const registerCompany = vi.fn(async (values: { email: string }) => ({
  email: values.email.trim().toLowerCase(),
  cooldownSeconds: 60,
}));
vi.mock('../src/features/companyRegistration/api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  registerCompany: (values: { email: string }) => registerCompany(values),
}));

// reference lists (MW_003 A2): GET /api/reference/* answers from the fixtures
vi.mock('../src/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/apiClient')>();
  const { referenceResponse } = await import('./referenceFixtures');
  return {
    ...actual,
    apiRequest: async (method: string, path: string, options?: object) => {
      const url = new URL(path, 'http://api.test');
      if (method === 'GET' && url.pathname.startsWith('/reference/')) {
        return referenceResponse(url.pathname.slice('/reference/'.length), url.searchParams);
      }
      return actual.apiRequest(method as never, path as never, options);
    },
  };
});

const { default: CompanyRegistrationPage } =
  await import('../src/features/companyRegistration/pages/CompanyRegistrationPage');

window.scrollTo = () => {};

function renderWizard() {
  const router = createMemoryRouter(
    [
      {
        path: '/signup/company',
        element: (
          <>
            <Link to="/elsewhere">elsewhere</Link>
            <CompanyRegistrationPage />
          </>
        ),
      },
      { path: '/verify-email', element: <p>verify page</p> },
      { path: '/elsewhere', element: <p>elsewhere page</p> },
    ],
    { initialEntries: ['/signup/company'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const pdf = () => new File(['%PDF-1.7 test'], 'register.pdf', { type: 'application/pdf' });
const next = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Next' }));

/** Picks the country, waits for its regions, then picks the region (both lists are async). */
async function pickLocation(user: UserEvent, country: string, region: string, regionLabel: RegExp) {
  await screen.findByRole('option', { name: 'Egypt' });
  await user.selectOptions(screen.getByLabelText(/^Country(?! code)/), country);
  const select = await screen.findByLabelText(regionLabel);
  await waitFor(() => expect(select).toBeEnabled());
  await user.selectOptions(select, region);
}

async function fillAccount(
  user: UserEvent,
  activities: RegExp[],
  [country, region, regionLabel] = ['EG', 'EG-GZ', /^Governorate/] as [string, string, RegExp],
) {
  await user.type(screen.getByLabelText(/Legal company name/), 'Nile Shipping');
  await user.type(screen.getByLabelText(/Representative full name/), 'Ahmed Hassan');
  await user.type(screen.getByLabelText(/Representative job title/), 'Owner');
  await user.type(screen.getByLabelText(/Business email/), 'Ops@Nile.com');
  await user.type(screen.getByLabelText(/Mobile phone/), '1012345678');
  await pickLocation(user, country, region, regionLabel);
  await user.type(screen.getByLabelText(/City \/ Area/), 'Dokki');
  await user.type(screen.getByLabelText(/Street address/), '5 Tahrir Street');
  await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'Str0ng!pass');
  await user.type(screen.getByLabelText(/^Confirm password/), 'Str0ng!pass');
  for (const activity of activities)
    await user.click(screen.getByRole('checkbox', { name: activity }));
}

beforeEach(() => {
  localStorage.clear();
  registerCompany.mockClear();
});

describe('company registration wizard', () => {
  it('"Next" validates the current step only', async () => {
    const user = userEvent.setup();
    renderWizard();
    await next(user);
    expect(screen.getByRole('heading', { name: 'Company' })).toBeInTheDocument(); // still step 1
    expect(screen.getAllByText('This field is required').length).toBeGreaterThan(3);
    expect(screen.getByText('Select at least one option')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(
      'Account & company',
    );
  });

  it('skips Services when "Other" is the only activity; Back keeps the data', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillAccount(user, [/^Other/]);
    await user.type(screen.getByLabelText(/Describe the other activity/), 'Warehousing');
    await next(user);
    expect(screen.getByRole('heading', { name: 'Legal information' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Documents');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText(/Legal company name/)).toHaveValue('Nile Shipping');
    expect(screen.getByLabelText(/Describe the other activity/)).toHaveValue('Warehousing');
  });

  it('Services shows only the sections of the selected activities', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillAccount(user, [/^Shipping from Chinese sites/]);
    await next(user);
    expect(
      screen.getByRole('heading', { name: 'Shipping from Chinese sites' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Domestic land shipping' }),
    ).not.toBeInTheDocument();
    await next(user);
    expect(screen.getAllByText('Select at least one option')).toHaveLength(2); // sites + services
  });

  it('checks picked files by content and submits everything, then goes to /verify-email', async () => {
    const user = userEvent.setup();
    const router = renderWizard();
    await fillAccount(user, [/^Other/]);
    await user.type(screen.getByLabelText(/Describe the other activity/), 'Warehousing');
    await next(user);

    await user.type(screen.getByLabelText(/Commercial register number/), '123');
    const tax = screen.getByLabelText(/Tax card number/);
    await user.type(tax, '123456789');
    expect(tax).toHaveValue('123-456-789'); // input mask

    const register = screen.getByLabelText(/Commercial register copy/);
    const exe = new File(['MZ\u0090\u0000'], 'register.pdf', { type: 'application/pdf' });
    await user.upload(register, exe);
    expect(await screen.findByText('Upload a PDF, JPG or PNG file')).toBeInTheDocument();
    await user.upload(screen.getByLabelText(/Commercial register copy/), pdf());
    expect(await screen.findByText('register.pdf')).toBeInTheDocument();

    await next(user); // tax card copy missing
    expect(screen.getByText('This document is required')).toBeInTheDocument();
    await user.upload(
      screen.getByLabelText(/Tax card copy/),
      new File(['%PDF-1.4'], 'tax.pdf', { type: 'application/pdf' }),
    );
    await screen.findByText('tax.pdf');
    await next(user);

    // review: summary + edit links + required confirmations
    expect(screen.getByText('Nile Shipping')).toBeInTheDocument();
    expect(screen.getByText('123-456-789')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Documents/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(
      screen.getByText('You must confirm that the information is accurate'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /I confirm that all information/ }));
    await user.click(screen.getByRole('checkbox', { name: /I agree to the Terms/ }));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
    const [sent] = registerCompany.mock.calls[0]! as unknown as [
      Record<string, unknown> & { files: Record<string, File> },
    ];
    expect(sent).toMatchObject({
      legalName: 'Nile Shipping',
      taxNumber: '123-456-789',
      termsVersion: '2026-11-21',
    });
    expect(
      Object.keys(sent.files)
        .filter((type) => sent.files[type])
        .sort(),
    ).toEqual(['commercial_register', 'tax_card']);
    expect(localStorage.getItem('mirhalgo.companyDraft')).toBeNull(); // cleared after submit
    expect(sessionStorage.getItem('mirhalgo.pendingKind')).toBe('company');
  });

  it('country → region list, region label, phone code and legal rules (MW_003 A2)', async () => {
    const user = userEvent.setup();
    renderWizard();
    const dialCode = () => screen.getAllByLabelText('Country code')[0]!;

    await pickLocation(user, 'SA', 'SA-01', /^Region/);
    expect(dialCode()).toHaveValue('SA'); // the empty phone follows the country
    expect(screen.getByRole('option', { name: 'Makkah' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cairo' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Country(?! code)/), 'AE');
    const emirate = await screen.findByLabelText(/^Emirate/);
    expect(emirate).toHaveValue(''); // the previous selection is cleared
    expect(dialCode()).toHaveValue('AE');

    // a number already typed keeps its code
    await user.type(screen.getByLabelText(/Mobile phone/), '501234567');
    await user.selectOptions(screen.getByLabelText(/^Country(?! code)/), 'EG');
    await screen.findByLabelText(/^Governorate/);
    expect(dialCode()).toHaveValue('AE');
  });

  it('Saudi company: CR / VAT labels, document names and the 15-digit VAT rule', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillAccount(user, [/^Other/], ['SA', 'SA-01', /^Region/]);
    await user.type(screen.getByLabelText(/Describe the other activity/), 'Warehousing');
    await next(user);

    expect(screen.getByLabelText(/Commercial Registration number \(CR\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/VAT registration certificate/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Commercial Registration number/), '1010123456');
    const vat = screen.getByLabelText(/^VAT number/);
    await user.type(vat, '123-456-789');
    expect(vat).toHaveValue('123456789'); // no Egyptian mask: digits only
    await next(user);
    expect(screen.getByText('Enter the 15-digit VAT number')).toBeInTheDocument();
  });

  it('domestic coverage lists the regions of the company country', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillAccount(user, [/^Domestic land shipping/], ['AE', 'AE-DU', /^Emirate/]);
    await next(user);
    expect(screen.getByRole('switch', { name: 'All emirates' })).toBeInTheDocument();
    const covered = screen.getByRole('group', { name: /Covered emirates/ });
    expect(within(covered).getByRole('checkbox', { name: 'Dubai' })).toBeInTheDocument();
    expect(within(covered).queryByRole('checkbox', { name: 'Cairo' })).not.toBeInTheDocument();
  });

  it('restores a saved country + region once their lists have loaded', async () => {
    localStorage.setItem(
      'mirhalgo.companyDraft',
      JSON.stringify({
        savedAt: Date.now(),
        values: { legalName: 'Gulf Co', country: 'SA', region: 'SA-02' },
      }),
    );
    renderWizard();
    expect(await screen.findByRole('option', { name: 'Makkah' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Country(?! code)/)).toHaveValue('SA');
    expect(screen.getByLabelText(/^Region/)).toHaveValue('SA-02');
  });

  /** Types a company name + password, waits for the autosave, then "comes back" to the page. */
  async function saveDraftAndReturn(user: UserEvent) {
    renderWizard();
    await user.type(screen.getByLabelText(/Legal company name/), 'Delta Cargo');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'Str0ng!pass');
    await waitFor(() =>
      expect(localStorage.getItem('mirhalgo.companyDraft')).toContain('Delta Cargo'),
    );
    expect(localStorage.getItem('mirhalgo.companyDraft')).not.toContain('Str0ng');
    document.body.innerHTML = '';
    return renderWizard();
  }

  it('no draft: no restored notice', () => {
    renderWizard();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Legal company name/)).toHaveValue('');
  });

  it('autosaves the text (never the password) and restores it automatically', async () => {
    const user = userEvent.setup();
    await saveDraftAndReturn(user);
    // no "Continue your application?" prompt: the draft is already back, with a subtle notice
    expect(screen.queryByRole('heading', { name: /Continue/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('We restored your saved progress.');
    expect(screen.getByLabelText(/Legal company name/)).toHaveValue('Delta Cargo');
    expect(screen.getByLabelText(/^Password/, { selector: 'input' })).toHaveValue('');

    // restoring is not an edit: the stored draft is unchanged
    const stored = localStorage.getItem('mirhalgo.companyDraft');
    await new Promise((resolve) => setTimeout(resolve, 700)); // > autosave delay
    expect(localStorage.getItem('mirhalgo.companyDraft')).toBe(stored);

    await user.click(screen.getByRole('button', { name: 'Dismiss this notice' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Legal company name/)).toHaveValue('Delta Cargo'); // data kept
  });

  it('"Start over" clears the draft and resets the form', async () => {
    const user = userEvent.setup();
    await saveDraftAndReturn(user);
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const name = screen.getByLabelText(/Legal company name/);
    expect(name).toHaveValue('');
    await waitFor(() => expect(name).toHaveFocus());
    expect(localStorage.getItem('mirhalgo.companyDraft')).toBeNull();
    // the reset itself never writes an (empty) draft back
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(localStorage.getItem('mirhalgo.companyDraft')).toBeNull();

    document.body.innerHTML = '';
    renderWizard();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('asks before leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    const router = renderWizard();
    await user.type(screen.getByLabelText(/Legal company name/), 'Delta Cargo');
    await user.click(screen.getByRole('link', { name: 'elsewhere' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave the registration?' });
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe('/signup/company');

    await user.click(screen.getByRole('link', { name: 'elsewhere' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'));
  });
});
