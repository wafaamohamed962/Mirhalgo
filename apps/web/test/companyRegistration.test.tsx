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

async function fillAccount(user: UserEvent, activities: RegExp[]) {
  await user.type(screen.getByLabelText(/Legal company name/), 'Nile Shipping');
  await user.type(screen.getByLabelText(/Representative full name/), 'Ahmed Hassan');
  await user.type(screen.getByLabelText(/Representative job title/), 'Owner');
  await user.type(screen.getByLabelText(/Business email/), 'Ops@Nile.com');
  await user.type(screen.getByLabelText(/Mobile phone/), '1012345678');
  await user.selectOptions(screen.getByLabelText(/Governorate/), 'giza');
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

  it('autosaves the text (never the password) and offers to continue', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText(/Legal company name/), 'Delta Cargo');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'Str0ng!pass');
    await waitFor(() =>
      expect(localStorage.getItem('mirhalgo.companyDraft')).toContain('Delta Cargo'),
    );
    expect(localStorage.getItem('mirhalgo.companyDraft')).not.toContain('Str0ng');

    document.body.innerHTML = '';
    renderWizard();
    expect(screen.getByRole('heading', { name: 'Continue your application?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText(/Legal company name/)).toHaveValue('Delta Cargo');
    expect(screen.getByLabelText(/^Password/, { selector: 'input' })).toHaveValue('');
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
