import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyAccount, CompanyDashboard } from '@mirhalgo/shared';
import {
  ACCOUNT_ID,
  companyFetch,
  renderCompany,
  resetCompanyMocks,
  server,
} from './renderCompany';

/* Account settings (MW_004 spec B9) + the demo tools (dev / staging only). */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

const block = async (name: string) => within(await screen.findByRole('region', { name }));
const lastActivity = async () => (await companyFetch<CompanyDashboard>('/dashboard')).activity[0];

describe('Account settings', { timeout: 20_000 }, () => {
  it('company data: legal name and activity read-only; contact email / phone validated and saved', async () => {
    const user = userEvent.setup();
    renderCompany('/company/settings');
    const company = await block('Company data');
    expect(company.getByText('أليكس إكسبريس للشحن الدولي واللوجستيات')).toBeInTheDocument();
    expect(
      company.getByText('International shipping (shipping & customs clearance)'),
    ).toBeInTheDocument();
    const email = company.getByLabelText(/Contact email/);
    expect(email).toHaveValue('demo.company@mirhalgo.com');

    await user.clear(email);
    await user.type(email, 'not-an-email');
    await user.click(company.getByRole('button', { name: 'Save' }));
    expect(await company.findByText('Enter a valid email address')).toBeInTheDocument();

    await user.clear(email);
    await user.type(email, 'ops@alex.example');
    await user.click(company.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The contact details were saved.')).toBeInTheDocument();
    expect((await companyFetch<CompanyAccount>('/me')).contactEmail).toBe('ops@alex.example');
    expect(await lastActivity()).toMatchObject({ type: 'contact_updated' });
  });

  it('offer privacy: the switch saves, shows a toast and is logged', async () => {
    const user = userEvent.setup();
    renderCompany('/company/settings');
    const privacy = await block('Offer privacy');
    expect(
      privacy.getByText(/stay fully visible to the platform administration and the client/),
    ).toBeInTheDocument();
    await user.click(
      privacy.getByRole('switch', { name: 'Hide our offers from competitor companies' }),
    );
    expect(
      await screen.findByText('Your offers are now hidden from competitor companies.'),
    ).toBeInTheDocument();
    expect((await companyFetch<CompanyAccount>('/me')).hideOffers).toBe(true);
    expect(await lastActivity()).toMatchObject({ type: 'privacy_changed', hideOffers: true });
    await waitFor(() => expect(privacy.getByRole('switch')).toBeChecked());
  });

  it('offer submission status: read-only, set by the administration (here: the demo switch)', async () => {
    const user = userEvent.setup();
    renderCompany('/company/settings');
    const status = await block('Offer submission status');
    expect(status.getByText('Allowed')).toBeInTheDocument();
    expect(status.queryByRole('switch')).not.toBeInTheDocument();
    const demo = await block('Demo tools');
    await user.click(
      demo.getByRole('switch', { name: 'Simulate a suspension of offer submission' }),
    );
    expect(await status.findByText('Suspended')).toBeInTheDocument();
  });

  it('password: current + new + confirm, the sign-up policy; a wrong current password fails', async () => {
    const user = userEvent.setup();
    renderCompany('/company/settings');
    const password = await block('Password');
    await user.type(password.getByLabelText(/^Current password/), 'wrong');
    await user.type(password.getByLabelText(/^New password/), 'short');
    await user.type(password.getByLabelText(/^Confirm the new password/), 'short');
    await user.click(password.getByRole('button', { name: 'Change password' }));
    expect(await password.findAllByText(/at least 8 characters|8 characters/)).not.toHaveLength(0);

    await user.clear(password.getByLabelText(/^New password/));
    await user.type(password.getByLabelText(/^New password/), 'N3w!Password');
    await user.clear(password.getByLabelText(/^Confirm the new password/));
    await user.type(password.getByLabelText(/^Confirm the new password/), 'N3w!Password');
    await user.click(password.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Invalid email/phone or password')).toBeInTheDocument();

    await user.clear(password.getByLabelText(/^Current password/));
    await user.type(password.getByLabelText(/^Current password/), 'old-password');
    await user.click(password.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('The password was changed.')).toBeInTheDocument();
    await waitFor(() => expect(password.getByLabelText(/^Current password/)).toHaveValue(''));
  });

  it('demo tools: "Reset demo data" asks, then restores the first state and the "New" badges', async () => {
    const user = userEvent.setup();
    await companyFetch('/settings/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ hideOffers: true }),
    });
    localStorage.setItem(
      `mirhalgo.companySeen.v1.${ACCOUNT_ID}`,
      JSON.stringify({ request: ['MG1029'] }),
    );
    renderCompany('/company/settings');
    const demo = await block('Demo tools');
    await user.click(demo.getByRole('button', { name: 'Reset demo data' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Reset the demo data?' }));
    await user.click(confirm.getByRole('button', { name: 'Reset demo data' }));
    expect(await screen.findByText('The demo data was reset.')).toBeInTheDocument();
    expect((await companyFetch<CompanyAccount>('/me')).hideOffers).toBe(false);
    expect(localStorage.getItem(`mirhalgo.companySeen.v1.${ACCOUNT_ID}`)).toBeNull();
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Offer privacy' })).getByRole('switch'),
      ).not.toBeChecked(),
    );
  });
});
