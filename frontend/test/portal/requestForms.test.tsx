import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderUploadPurpose } from '@mirhalgo/shared';
import { ordersApi } from '../../src/services/api/orders';
import {
  apiState,
  draftStore,
  renderPortal,
  resetPortalDb,
  server,
  submitted,
} from './renderPortal';

/* MW_003 B5: the New Request forms on the real page, the API answered by the test harness. */

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetPortalDb();
  apiState.drafts = [];
  localStorage.clear();
  window.scrollTo = () => {};
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => server.close());

const main = () => within(screen.getByRole('main'));
const next = (user: UserEvent) => user.click(main().getByRole('button', { name: /^Next/ }));
/**
 * Serves `payload` as the saved draft. Not through draftStore: the previous test flushes its own
 * draft when it unmounts (by design), and that late PUT would overwrite a planted one.
 */
function serveDraft(formVersion: string, payload: Record<string, unknown>) {
  server.use(
    http.get('*/api/orders/drafts/domestic', () =>
      HttpResponse.json({
        ok: true,
        data: { formVersion, payload, uploads: [], updatedAt: new Date().toISOString() },
      }),
    ),
  );
}

// the first step waits for the lazy form chunk: slower than findBy's 1 s default while the
// whole suite runs in parallel
const stepIs = (n: number, total: number, name: string) =>
  main().findByText(`Step ${n} of ${total}: ${name}`, {}, { timeout: 5000 });

/** Types `option` in a combobox and picks it (ports / airports also show their code). */
async function pick(user: UserEvent, label: RegExp, option: string) {
  const input = main().getByRole('combobox', { name: label });
  await user.click(input);
  await user.type(input, option);
  const name = new RegExp(`^${option}([A-Z]{3,5})?$`); // name + optional code (CNSHA)
  await user.click(await screen.findByRole('option', { name }));
}

/** Domestic · general cargo · LTL, filled up to the Review step. */
async function fillDomestic(user: UserEvent) {
  renderPortal('/app/new-request/domestic');
  await stepIs(1, 6, 'Customer');
  // the contact comes from the profile
  expect(main().getByLabelText(/Full name/)).toHaveValue('Wafaa Mohamed');

  // Next validates the current step only
  await next(user);
  expect(await main().findByText('This field is required')).toBeInTheDocument();
  await user.click(main().getByRole('radio', { name: 'Individual' }));
  await next(user);

  await stepIs(2, 6, 'Operation');
  expect(main().getByText('Domestic')).toBeInTheDocument();
  await next(user);

  await stepIs(3, 6, 'Route');
  await user.click(main().getByRole('radio', { name: 'General cargo' }));
  await user.click(await main().findByRole('radio', { name: 'Part load (LTL)' }));
  await pick(user, /Loading governorate/, 'Cairo');
  await pick(user, /Unloading governorate/, 'Giza');
  await next(user);

  await stepIs(4, 6, 'Cargo');
  await user.type(main().getByLabelText(/^Cargo description/), 'Spare parts in cartons');
  await user.click(main().getByRole('radio', { name: 'Manual entry' }));
  await user.type(await main().findByLabelText(/^Total weight/), '٥٠٠'); // Arabic digits
  await user.type(main().getByLabelText(/^Number of pieces/), '12');
  await user.click(main().getByRole('radio', { name: 'No' }));
  fireEvent.change(main().getByLabelText(/^Cargo ready date/), { target: { value: '2099-01-15' } });
  await next(user);

  await stepIs(5, 6, 'Additional services');
  await next(user);
  await stepIs(6, 6, 'Review');
}

// long multi-step flows: more than the 5 s default under the full parallel run
describe('New Request forms (B5)', { timeout: 20_000 }, () => {
  it('domestic LTL end to end: review summary, confirmation, idempotent submit, success page', async () => {
    const user = userEvent.setup();
    await fillDomestic(user);
    expect(main().getByText('Giza')).toBeInTheDocument();
    expect(main().getByText('Part load (LTL)')).toBeInTheDocument();
    expect(
      main().getByText(/One request will be used from your balance \(remaining: 3\)/),
    ).toBeInTheDocument();

    await user.click(main().getByRole('button', { name: /Send request/ }));
    expect(
      await main().findByText('You must confirm that the information is accurate'),
    ).toBeInTheDocument();
    expect(submitted).toHaveLength(0);

    await user.click(main().getByRole('checkbox', { name: /I confirm/ }));
    await user.click(main().getByRole('button', { name: /Send request/ }));
    expect(
      await main().findByRole('heading', { name: 'Your request was sent' }),
    ).toBeInTheDocument();
    expect(main().getByText('MG1001')).toBeInTheDocument();

    expect(submitted).toHaveLength(1);
    const [{ key, body }] = submitted as [(typeof submitted)[number]];
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toMatchObject({
      service: 'domestic',
      formVersion: 'domestic@1',
      contact: { fullName: 'Wafaa Mohamed', clientType: 'individual' },
      shipment: {
        landType: 'general',
        loadType: 'ltl',
        loadingRegion: 'EG-C',
        unloadingRegion: 'EG-GZ',
        cargo: { kind: 'ltl', inputMethod: 'manual', hazardous: false },
      },
      confirmAccuracy: true,
    });
    // a hidden branch never travels: no container port, no international-only fields
    expect(body.shipment).not.toHaveProperty('dischargePort');
    expect(body).not.toHaveProperty('operation');
  });

  it('no requests left: the form is open but Send is disabled with an explanation', async () => {
    apiState.balance.remaining = 0;
    const user = userEvent.setup();
    await fillDomestic(user);
    expect(main().getByRole('alert')).toHaveTextContent(/no requests left/);
    expect(main().getByRole('button', { name: /Send request/ })).toBeDisabled();
  });

  it('Back keeps the data; switching a branch clears the hidden values', async () => {
    const user = userEvent.setup();
    renderPortal('/app/new-request/domestic');
    await stepIs(1, 6, 'Customer');
    await user.click(main().getByRole('radio', { name: 'Company' }));
    await user.type(main().getByLabelText(/^Company name/), 'Acme Trading');
    await next(user);
    await stepIs(2, 6, 'Operation');
    await user.click(main().getByRole('button', { name: /^Back/ }));
    expect(await main().findByLabelText(/^Company name/)).toHaveValue('Acme Trading');

    // company → individual hides the business name, its value is cleared
    await user.click(main().getByRole('radio', { name: 'Individual' }));
    expect(main().queryByLabelText(/^Company name/)).not.toBeInTheDocument();
    await user.click(main().getByRole('radio', { name: 'Company' }));
    expect(main().getByLabelText(/^Company name/)).toHaveValue('');
  });

  it('restores the server draft (notice + values) and autosaves edits', async () => {
    serveDraft('domestic@1', {
      contact: { fullName: 'Saved Name', clientType: 'factory', businessName: 'Nile Factory' },
    });
    const user = userEvent.setup();
    renderPortal('/app/new-request/domestic');
    expect(await main().findByText(/We restored your saved progress/)).toBeInTheDocument();
    expect(main().getByLabelText(/Full name/)).toHaveValue('Saved Name');
    expect(main().getByLabelText(/^Factory name/)).toHaveValue('Nile Factory');

    await user.type(main().getByLabelText(/^Factory name/), ' 2');
    await waitFor(
      () =>
        expect(draftStore.domestic?.payload).toMatchObject({
          contact: { businessName: 'Nile Factory 2' },
        }),
      { timeout: 3000 },
    );
  });

  it('a draft of another form version is ignored', async () => {
    serveDraft('domestic@0', { contact: { fullName: 'Old Shape' } });
    renderPortal('/app/new-request/domestic');
    await stepIs(1, 6, 'Customer');
    expect(main().getByLabelText(/Full name/)).toHaveValue('Wafaa Mohamed');
    expect(main().queryByText(/We restored/)).not.toBeInTheDocument();
  });

  it('china · SHEIN · cart link: durations from the configured estimates, delivery, submit', async () => {
    const user = userEvent.setup();
    renderPortal('/app/new-request/china');
    await stepIs(1, 4, 'Customer');
    await user.click(main().getByRole('radio', { name: 'Trader' }));
    await next(user);

    await stepIs(2, 4, 'Order');
    await user.click(main().getByRole('radio', { name: 'SHEIN' }));
    await user.click(await main().findByRole('radio', { name: 'shein.sa' }));
    await user.click(main().getByRole('radio', { name: 'Cart link' }));
    await user.type(
      await main().findByRole('textbox', { name: /^Cart link/ }),
      'http://shein.sa/cart',
    );
    await next(user);
    expect(await main().findByText('Enter a link that starts with https://')).toBeInTheDocument();
    await user.clear(main().getByRole('textbox', { name: /^Cart link/ }));
    await user.type(
      main().getByRole('textbox', { name: /^Cart link/ }),
      'https://shein.sa/cart/abc',
    );
    await next(user);

    await stepIs(3, 4, 'Shipping & delivery');
    expect(main().getByText('10–15 days')).toBeInTheDocument(); // SHEIN air (decision 28)
    await user.click(main().getByRole('radio', { name: /Air/ }));
    await pick(user, /Delivery country/, 'Egypt');
    await pick(user, /^City/, 'Cairo');
    await user.type(main().getByLabelText(/^Delivery address/), 'Nasr City, street 9');
    expect(main().getByLabelText(/^Receiver name/)).toHaveValue('Wafaa Mohamed');
    await next(user);

    await stepIs(4, 4, 'Review');
    await user.click(main().getByRole('checkbox', { name: /I confirm/ }));
    await user.click(main().getByRole('button', { name: /Send request/ }));
    expect(
      await main().findByRole('heading', { name: 'Your request was sent' }),
    ).toBeInTheDocument();
    expect(submitted[0]?.body).toMatchObject({
      service: 'china',
      order: {
        source: 'shein',
        sheinSite: 'shein_sa',
        addMethod: 'cart_link',
        cartLink: 'https://shein.sa/cart/abc',
      },
      delivery: { shippingMethod: 'air', country: { id: 'EG' }, city: { id: 'EG-CAIRO' } },
    });
    expect(submitted[0]?.body.order).not.toHaveProperty('products');
  });

  it('international sea FCL: customs location, container group, MSDS + invoice uploads, submit', async () => {
    // jsdom's XHR does not get MSW's answer to an upload: the upload call itself is stubbed
    // (the XHR path is covered by E2E, the field by attachmentField.test.tsx)
    vi.spyOn(ordersApi, 'uploadFile').mockImplementation(
      async (file, purpose: OrderUploadPurpose) => ({
        id: crypto.randomUUID(),
        purpose,
        name: file.name,
        mime: 'application/pdf',
        size: file.size,
        createdAt: new Date().toISOString(),
      }),
    );
    const user = userEvent.setup();
    const pdf = (name: string) => new File(['%PDF-1.7 test'], name, { type: 'application/pdf' });
    renderPortal('/app/new-request/international');
    await stepIs(1, 6, 'Customer');
    await user.click(main().getByRole('radio', { name: 'Company' }));
    await user.type(main().getByLabelText(/^Company name/), 'Acme Trading');
    await next(user);

    await stepIs(2, 6, 'Operation');
    await user.click(main().getByRole('radio', { name: 'Import' }));
    await user.click(main().getByRole('radio', { name: 'Shipping + customs clearance' }));
    await user.click(main().getByRole('radio', { name: 'Sea' }));
    await next(user);

    await stepIs(3, 6, 'Route');
    await user.click(main().getByRole('radio', { name: 'Full container (FCL)' }));
    await pick(user, /^Origin country/, 'China');
    await pick(user, /^Port of loading/, 'Shanghai');
    await pick(user, /^Destination country/, 'Egypt');
    await pick(user, /^Port of discharge/, 'Alexandria');
    // customs is part of the scope: the clearance location is required
    await next(user);
    expect(await main().findByText('This field is required')).toBeInTheDocument();
    await user.click(main().getByRole('radio', { name: 'Destination' }));
    await next(user);

    await stepIs(4, 6, 'Cargo');
    await pick(user, /^Container type/, "40' High Cube");
    await user.clear(main().getByLabelText(/^Number of containers/));
    await user.type(main().getByLabelText(/^Number of containers/), '2');
    await user.type(main().getByLabelText(/^Cargo description for this group/), 'Furniture');
    await user.click(main().getByRole('radio', { name: 'Yes' }));
    fireEvent.change(main().getByLabelText(/^Cargo ready date/), {
      target: { value: '2099-01-15' },
    });
    // hazardous goods need their MSDS before "Next"
    await next(user);
    expect(await main().findByText('This field is required')).toBeInTheDocument();
    await user.upload(main().getByLabelText(/^MSDS/), pdf('msds.pdf'));
    await user.upload(main().getByLabelText(/^Commercial invoice/), pdf('invoice.pdf'));
    expect(await main().findByText('invoice.pdf')).toBeInTheDocument();
    await next(user);

    await stepIs(5, 6, 'Additional services');
    await user.click(main().getByRole('radio', { name: "My company's documents" }));
    await next(user);

    await stepIs(6, 6, 'Review');
    expect(main().getByText('invoice.pdf')).toBeInTheDocument();
    expect(main().getByText('Shanghai')).toBeInTheDocument();
    await user.click(main().getByRole('checkbox', { name: /I confirm/ }));
    await user.click(main().getByRole('button', { name: /Send request/ }));
    expect(
      await main().findByRole('heading', { name: 'Your request was sent' }),
    ).toBeInTheDocument();

    const body = submitted[0]!.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body).toMatchObject({
      service: 'international',
      operation: { operationType: 'import', serviceScope: 'shipping_customs' },
      shipment: {
        mode: 'sea',
        seaType: 'fcl',
        origin: { country: 'CN', port: { id: 'CN-SHANGHAI' } },
        destination: { country: 'EG', port: { id: 'EG-ALEXANDRIA' } },
        clearanceLocation: 'destination',
        cargo: {
          kind: 'containers',
          groups: [{ containerType: '40_high_cube', count: '2', description: 'Furniture' }],
          hazardous: true,
        },
      },
      services: { executionDocuments: 'client' },
    });
    expect(body.shipment.cargo.msdsUploadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.shipmentDocuments.commercialInvoice).toHaveLength(1);
    expect(body.shipment).not.toHaveProperty('airService');
  });

  it('a list shown again starts with exactly one row (StrictMode runs effects twice)', async () => {
    // regression (B7 real run): FCL → LCL → FCL hides and re-shows the container groups; the
    // "at least one row" effect ran twice in StrictMode and the Cargo step showed two groups
    const user = userEvent.setup();
    renderPortal('/app/new-request/international');
    await stepIs(1, 6, 'Customer');
    await user.click(main().getByRole('radio', { name: 'Individual' }));
    await next(user);
    await user.click(main().getByRole('radio', { name: 'Export' }));
    await user.click(main().getByRole('radio', { name: 'Shipping only' }));
    await user.click(main().getByRole('radio', { name: 'Sea' }));
    await next(user);
    await user.click(await main().findByRole('radio', { name: 'Full container (FCL)' }));
    await user.click(main().getByRole('radio', { name: 'Part load (LCL)' }));
    await user.click(main().getByRole('radio', { name: 'Full container (FCL)' }));
    await pick(user, /^Origin country/, 'China');
    await pick(user, /^Port of loading/, 'Shanghai');
    await pick(user, /^Destination country/, 'Egypt');
    await pick(user, /^Port of discharge/, 'Alexandria');
    await next(user);
    await stepIs(4, 6, 'Cargo');
    expect(main().getAllByRole('combobox', { name: /^Container type/ })).toHaveLength(1);
  });

  it('an unknown service goes back to the service list', async () => {
    renderPortal('/app/new-request/rocket');
    expect(await main().findByText('What do you want to ship?')).toBeInTheDocument();
  });
});
