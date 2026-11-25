import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CompanyOffer, CompanyRequest } from '@mirhalgo/shared';
import RequestsPage from '../../src/features/companyPortal/pages/RequestsPage';
import { companyFetch, renderCompany, resetCompanyMocks, server } from './renderCompany';

/* Submit / edit offer (MW_004 spec B5): templates, total rules, suspension, unsaved data. */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

async function openRequest(category: string) {
  const requests = await companyFetch<CompanyRequest[]>('/requests');
  return requests.find((r) => r.category === category && r.status === 'open')!;
}
const renderForm = (orderId: string) =>
  renderCompany(`/company/requests?order=${orderId}&offer=new`, { requests: <RequestsPage /> });
const dialog = async (name: string | RegExp) =>
  within(await screen.findByRole('dialog', { name }, { timeout: 5000 }));
/** The offer form, once loaded (a loading modal with the same title comes first). */
const offerForm = async (name: string) => {
  await screen.findByRole('button', { name: /^(Send offer|Save changes)$/ }, { timeout: 5000 });
  return dialog(name);
};
const ourOffers = () => companyFetch<CompanyOffer[]>('/offers');

describe('offer form', { timeout: 20_000 }, () => {
  it('domestic (EGP only): total required, Arabic digits, sent → under review, the lists update', async () => {
    const user = userEvent.setup();
    const request = await openRequest('domestic_land');
    const router = renderForm(request.id);
    const form = await offerForm(`Submit an offer on request ${request.id}`);
    expect(form.getByText('Domestic land')).toBeInTheDocument(); // the template
    expect(form.queryByLabelText('Amount in a foreign currency')).not.toBeInTheDocument();
    // cost lines start in EGP for domestic land
    expect(form.getAllByRole('combobox', { name: 'Currency' })[0]).toHaveValue('EGP');

    await user.click(form.getByRole('button', { name: 'Send offer' }));
    expect(await form.findByText('This field is required')).toBeInTheDocument();

    await user.type(form.getByLabelText(/Amount in Egyptian pounds/), '٧٥٠٠');
    await user.type(form.getByLabelText('Transit time'), '٢');
    await user.click(form.getByRole('button', { name: 'Send offer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/was sent and is now under review/)).toBeInTheDocument();
    expect(router.state.location.search).toBe('');

    const [newest] = await ourOffers();
    expect(newest).toMatchObject({
      orderId: request.id,
      status: 'under_review',
      total: { egp: 7500 },
      details: { transitDays: 2 },
    });
    const table = within(await screen.findByRole('table'));
    const row = within(table.getByText(request.id).closest('tr')!);
    expect(await row.findByText(`(you have ${request.ourOffersCount + 1})`)).toBeInTheDocument();
  });

  it('sea (dual): foreign and/or EGP, at least one; USD by default for cost lines', async () => {
    const user = userEvent.setup();
    const request = await openRequest('sea');
    renderForm(request.id);
    const form = await offerForm(`Submit an offer on request ${request.id}`);
    expect(form.getAllByRole('combobox', { name: 'Currency' })[0]).toHaveValue('USD');
    await user.click(form.getByRole('button', { name: 'Send offer' }));
    expect(
      await form.findByText('Enter the total in a foreign currency, in Egyptian pounds, or both.'),
    ).toBeInTheDocument();

    await user.type(form.getByLabelText('Amount in a foreign currency'), '1000');
    await user.selectOptions(form.getAllByRole('combobox', { name: 'Currency' }).at(-1)!, 'EUR');
    await user.click(form.getByRole('button', { name: 'Send offer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await ourOffers())[0]!.total).toEqual({ foreign: { amount: 1000, currency: 'EUR' } });
  });

  it('field rules: days 1–365, no past date, positive amounts', async () => {
    const user = userEvent.setup();
    const request = await openRequest('sea');
    renderForm(request.id);
    const form = await offerForm(`Submit an offer on request ${request.id}`);
    await user.type(form.getByLabelText('Transit time'), '0');
    await user.type(form.getByLabelText('Departure date'), '2020-01-01');
    await user.type(form.getByLabelText(/Amount in Egyptian pounds/), '-5');
    await user.click(form.getByRole('button', { name: 'Send offer' }));
    expect(await form.findByText('Enter a number of days from 1 to 365.')).toBeInTheDocument();
    expect(form.getByText('Choose today or a later date')).toBeInTheDocument();
    expect(form.getByText('Enter a valid number')).toBeInTheDocument();
    expect(await ourOffers()).toHaveLength(18); // nothing sent
  });

  it('suspended: the form explains it and cannot be sent', async () => {
    await companyFetch('/demo/offer-submission', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    });
    const request = await openRequest('air');
    renderForm(request.id);
    const form = await offerForm(`Submit an offer on request ${request.id}`);
    expect(await form.findByText(/suspended offer submission/)).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Send offer' })).toBeDisabled();
  });

  it('suspended while the form is open: an error toast, then the disabled state', async () => {
    const user = userEvent.setup();
    const request = await openRequest('domestic_land');
    renderForm(request.id);
    const form = await offerForm(`Submit an offer on request ${request.id}`);
    await user.type(form.getByLabelText(/Amount in Egyptian pounds/), '100');
    await companyFetch('/demo/offer-submission', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    });
    await user.click(form.getByRole('button', { name: 'Send offer' }));
    expect(
      await screen.findByText(
        'Submitting offers is suspended for your account. Please contact support.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(form.getByRole('button', { name: 'Send offer' })).toBeDisabled());
  });

  it('a request that no longer accepts offers says so', async () => {
    const requests = await companyFetch<CompanyRequest[]>('/requests');
    const closed = requests.find((r) => r.status !== 'open')!;
    renderForm(closed.id);
    const form = await dialog(`Submit an offer on request ${closed.id}`);
    expect(await form.findByText('This request no longer accepts offers.')).toBeInTheDocument();
  });

  it('closing with unsaved values asks first: Stay keeps the form, Leave closes it', async () => {
    const user = userEvent.setup();
    const request = await openRequest('domestic_land');
    renderForm(request.id);
    const form = await offerForm(`Submit an offer on request ${request.id}`);
    await user.type(form.getByLabelText(/Amount in Egyptian pounds/), '100');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    const confirm = await dialog('Close the offer form?');
    await user.click(confirm.getByRole('button', { name: 'Stay' }));
    expect(form.getByLabelText(/Amount in Egyptian pounds/)).toHaveValue('100');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await user.click(
      (await dialog('Close the offer form?')).getByRole('button', { name: 'Leave' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('edit offer', { timeout: 20_000 }, () => {
  it('prefilled; saved changes keep the offer under review', async () => {
    const user = userEvent.setup();
    const { OfferModal } = await import('../../src/features/companyPortal/offers/OfferModal');
    const offer = (await ourOffers()).find(
      (o) => o.status === 'under_review' && o.template === 'sea',
    )!;
    const closed: string[] = [];
    renderCompany('/company/offers', {
      offers: (
        <OfferModal
          orderId={offer.orderId}
          template="sea"
          offer={offer}
          suspended={false}
          onClose={() => closed.push('closed')}
        />
      ),
    });
    const form = await offerForm(`Edit offer ${offer.id}`);
    expect(form.getByText(/stays under review after saving/)).toBeInTheDocument();
    const egp = form.getByLabelText(/Amount in Egyptian pounds/);
    expect(egp).toHaveValue(String(offer.total.egp));
    await user.clear(egp);
    await user.type(egp, '15000');
    await user.click(form.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(closed).toEqual(['closed']));
    const saved = (await ourOffers()).find((o) => o.id === offer.id)!;
    expect(saved).toMatchObject({ status: 'under_review', total: { egp: 15000 } });
  });
});
