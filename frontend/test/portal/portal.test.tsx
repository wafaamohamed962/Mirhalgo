import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { flags } from '../../src/lib/env';
import { db, profileRow, renderPortal, resetPortalDb, server, apiState } from './renderPortal';

/* Customer portal (MW_002 Part B) against the MSW mocks: the same handlers as the preview. */

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetPortalDb();
  localStorage.clear();
  window.scrollTo = () => {};
});
afterAll(() => server.close());

const main = () => within(screen.getByRole('main'));

describe('portal shell (B1)', () => {
  it('shows the sidebar, page title, bell with unread count and the new-offers badge', async () => {
    renderPortal('/app');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New Request' }),
    ).toBeInTheDocument();
    const sidebar = screen.getAllByRole('navigation', { name: 'Customer portal' })[0]!;
    for (const name of ['New Request', 'My Orders', 'Companies', 'Account']) {
      expect(within(sidebar).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument();
    // orders 118 + 117 have unopened offers
    expect(within(sidebar).getByRole('link', { name: /My Orders/ })).toHaveTextContent('2');
  });

  it('bell: latest notifications, mark all as read', async () => {
    const user = userEvent.setup();
    renderPortal('/app');
    await user.click(await screen.findByRole('button', { name: 'Notifications, 3 unread' }));
    expect(screen.getAllByText(/New offer on your request/)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(db.notifications.every((n) => n.read)).toBe(true);
  });

  it('collapses the sidebar to icons and remembers it', async () => {
    const user = userEvent.setup();
    renderPortal('/app');
    await user.click(await screen.findByRole('button', { name: 'Collapse the sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(localStorage.getItem('mirhalgo.sidebarCollapsed')).toBe('true');
  });

  it('top-bar search opens My Orders filtered by reference', async () => {
    const user = userEvent.setup();
    const router = renderPortal('/app');
    await user.type(
      await screen.findByRole('searchbox', { name: /Search orders/ }),
      'MG-R-2026-000117{Enter}',
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/orders'));
    expect(await main().findByText('MG-R-2026-000117')).toBeInTheDocument();
    expect(main().queryByText('MG-R-2026-000118')).not.toBeInTheDocument();
  });
});

describe('own identity = the real profiles row, not the mocks (MW_002 assumption)', () => {
  it("welcome banner shows the logged-in user's first name", async () => {
    renderPortal('/app/new-request');
    expect(await main().findByRole('heading', { name: 'Welcome, Wafaa' })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(db.me.firstName))).not.toBeInTheDocument();
  });

  it('top-bar avatar menu shows the real name and email', async () => {
    const user = userEvent.setup();
    renderPortal('/app/new-request');
    await user.click(await screen.findByRole('button', { name: /Wafaa Mohamed/ }));
    expect(screen.getByText('Wafaa Mohamed')).toBeInTheDocument();
    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
  });

  it('a profile read error shows the error state, never the mock identity', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderPortal('/app/account/profile');
    expect(await main().findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(db.me.firstName)).not.toBeInTheDocument();
  });
});

describe('new request (B3)', () => {
  it('welcome, attempts, draft banner (discard) and pre-selected companies', async () => {
    const user = userEvent.setup();
    renderPortal('/app/new-request?companies=co_nile,co_delta');
    expect(await main().findByRole('heading', { name: 'Welcome, Wafaa' })).toBeInTheDocument();
    expect(await main().findByText('Remaining requests: 3 of 5')).toBeInTheDocument();
    expect(main().getByText('Sending to:')).toBeInTheDocument();
    await user.click(await main().findByRole('button', { name: 'Remove Nile Bridge Logistics' }));
    expect(main().queryByText('Nile Bridge Logistics')).not.toBeInTheDocument();

    await user.click(main().getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('The draft was discarded.')).toBeInTheDocument();
    expect(main().queryByText('You have an unfinished request')).not.toBeInTheDocument();
  });

  it('the summary is the real API: one draft row per service, discard calls DELETE /orders/drafts/:service', async () => {
    const user = userEvent.setup();
    apiState.drafts = [
      { service: 'china', updatedAt: new Date().toISOString() },
      { service: 'domestic', updatedAt: new Date().toISOString() },
    ];
    renderPortal('/app/new-request');
    expect(await main().findAllByText('You have an unfinished request')).toHaveLength(2);
    const [china] = main().getAllByRole('button', { name: 'Discard' });
    await user.click(china!);
    expect(await screen.findByText('The draft was discarded.')).toBeInTheDocument();
    await waitFor(() =>
      expect(main().getAllByText('You have an unfinished request')).toHaveLength(1),
    );
    expect(apiState.drafts.map((d) => d.service)).toEqual(['domestic']);
    expect(main().getByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/app/new-request/domestic',
    );
  });

  it('no requests left: red state and the service cards are disabled', async () => {
    apiState.balance.remaining = 0;
    renderPortal('/app/new-request');
    expect(await main().findByRole('alert')).toHaveTextContent(/no requests left/);
    for (const link of main().getAllByRole('link', { name: /Start request/ })) {
      expect(link).toHaveAttribute('aria-disabled', 'true');
    }
  });
});

describe('my orders (B4)', () => {
  it('tabs with counts, load more, search', async () => {
    const user = userEvent.setup();
    renderPortal('/app/orders');
    expect(await main().findByText('Orders: 9')).toBeInTheDocument();
    expect(main().getByRole('tab', { name: /All/ })).toHaveTextContent('9');
    expect(main().getAllByRole('article')).toHaveLength(5);
    await user.click(main().getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(main().getAllByRole('article')).toHaveLength(9));

    await user.click(main().getByRole('tab', { name: /Completed/ }));
    expect(await main().findByText('Orders: 2')).toBeInTheDocument();
    await user.click(main().getByRole('tab', { name: /Cancelled \/ Rejected/ }));
    expect(await main().findByText('Orders: 2')).toBeInTheDocument();
  });

  it('accept an offer (preliminary) and compare offers side by side', async () => {
    const user = userEvent.setup();
    renderPortal('/app/orders/ord_118?tab=offers');
    expect(await main().findByText('MirhalGo Partner #001')).toBeInTheDocument();

    await user.click(main().getByRole('button', { name: 'Compare offers' }));
    const table = main().getByRole('table', { name: 'Compare offers' });
    expect(within(table).getByText('Lowest')).toBeInTheDocument();
    await user.click(main().getByRole('button', { name: 'Show cards' }));

    await user.click(main().getAllByRole('button', { name: 'Accept' })[0]!);
    const dialog = screen.getByRole('dialog', {
      name: /Accept the offer from MirhalGo Partner #001/,
    });
    expect(dialog).toHaveTextContent('preliminary until final approval');
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }));
    expect(await main().findByText(/You selected MirhalGo Partner #001/)).toBeInTheDocument();
    expect(main().getByText('Awaiting final approval')).toBeInTheDocument();
    expect(db.orders.find((o) => o.id === 'ord_118')?.status).toBe('awaiting_approval');
  });

  it('reject an offer with a reason, ask a question', async () => {
    const user = userEvent.setup();
    renderPortal('/app/orders/ord_117?tab=offers');
    await user.click((await main().findAllByRole('button', { name: 'Reject' }))[0]!);
    let dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Too expensive');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Offer rejected.')).toBeInTheDocument();

    await user.click(main().getAllByRole('button', { name: 'Ask a question' })[0]!);
    dialog = screen.getByRole('dialog', { name: 'Ask a question' });
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(within(dialog).getByText('This field is required')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Your question/), 'Hi');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(within(dialog).getByText('Must be 5–1000 characters')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/Your question/));
    await user.type(within(dialog).getByLabelText(/Your question/), 'Is insurance included?');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Your question was sent.')).toBeInTheDocument();
  });

  it('cancel a request (only while allowed) and see the timeline', async () => {
    const user = userEvent.setup();
    renderPortal('/app/orders/ord_116');
    await user.click(await main().findByRole('button', { name: 'Cancel request' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel request' }),
    );
    expect(await main().findByText('This request was cancelled.')).toBeInTheDocument();
    expect(main().queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
    await user.click(main().getByRole('tab', { name: 'Timeline' }));
    expect(main().getByText('The request was cancelled.')).toBeInTheDocument();
  });

  it('shows an error state with retry when the API fails', async () => {
    server.use(
      http.get('*/api/orders/:id', () =>
        HttpResponse.json(
          { ok: false, error: { code: 'INTERNAL', message: 'x' } },
          { status: 500 },
        ),
      ),
    );
    renderPortal('/app/orders/ord_118');
    expect(await main().findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(main().getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('companies (B5)', () => {
  it('filter, select, bulk bar → New Request with the selected companies', async () => {
    const user = userEvent.setup();
    const router = renderPortal('/app/companies');
    expect(await main().findByText('Companies: 12')).toBeInTheDocument();
    await user.click(main().getByRole('radio', { name: 'SHEIN / China' }));
    expect(await main().findByText('Companies: 3')).toBeInTheDocument();
    expect(
      main().getByRole('button', { name: /Send to all SHEIN \/ China companies/ }),
    ).toBeInTheDocument();

    await user.click(main().getByRole('checkbox', { name: 'Select Red Dragon Sourcing' }));
    await user.click(main().getByRole('checkbox', { name: 'Select Yangtze Link' }));
    const bar = main().getByRole('region', { name: 'Selected companies' });
    expect(bar).toHaveTextContent('Selected: 2');
    await user.click(within(bar).getByRole('button', { name: 'Send request to selected' }));
    await waitFor(() =>
      expect(router.state.location.search).toBe('?companies=co_dragon,co_yangtze'),
    );
  });

  it('identity flag off: names are hidden behind "MirhalGo Partner #…"', async () => {
    flags.showCompanyIdentity = false;
    try {
      renderPortal('/app/companies');
      expect((await main().findAllByText(/^MirhalGo Partner #\d{3}$/)).length).toBe(12);
      expect(main().queryByText('Nile Bridge Logistics')).not.toBeInTheDocument();
    } finally {
      flags.showCompanyIdentity = true;
    }
  });

  it('rate a company only after a completed order', async () => {
    const user = userEvent.setup();
    renderPortal('/app/companies/co_nile');
    expect(
      await main().findByRole('heading', { name: 'Nile Bridge Logistics' }),
    ).toBeInTheDocument();
    await user.click(main().getByRole('button', { name: 'Submit rating' }));
    expect(main().getByText('Choose a rating from 1 to 5 stars')).toBeInTheDocument();
    await user.click(main().getByRole('radio', { name: 'Excellent' }));
    await user.click(main().getByRole('button', { name: 'Submit rating' }));
    expect(await main().findByText(/You rated this company 5 \/ 5/)).toBeInTheDocument();
    expect(await main().findByText('منى ع.')).toBeInTheDocument(); // the new review is listed
  });

  it('rating is locked for a company without a completed order; reviews can be liked', async () => {
    const user = userEvent.setup();
    renderPortal('/app/companies/co_dragon');
    await main().findByRole('heading', { name: 'Red Dragon Sourcing' });
    db.companies.find((c) => c.id === 'co_dragon')!.canRate = false;
    renderPortal('/app/companies/co_delta');
    expect(
      await screen.findByText('You can rate a company after it completes an order for you.'),
    ).toBeInTheDocument();
    const likes = (await screen.findAllByRole('button', { name: /Helpful/ }))[0]!;
    await user.click(likes);
    await waitFor(() => expect(likes).toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('account (B6)', () => {
  it('profile: real name/gender saved to the profiles row; email + phone read-only', async () => {
    const user = userEvent.setup();
    renderPortal('/app/account/profile');
    const first = await main().findByLabelText(/First name/);
    expect(first).toHaveValue('Wafaa');
    expect(main().getByLabelText(/Last name/)).toHaveValue('Mohamed');
    expect(main().getByLabelText(/Gender/)).toHaveValue('female');
    expect(main().getByDisplayValue('customer@example.com')).toHaveAttribute('readonly');
    expect(main().getByDisplayValue('+201098765432')).toHaveAttribute('readonly');
    expect(main().queryByRole('button', { name: /Change (email|phone)/ })).not.toBeInTheDocument();

    expect(main().getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(first);
    await user.type(first, 'Wafa');
    await user.selectOptions(main().getByLabelText(/Gender/), 'male');
    await user.click(main().getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your profile was saved.')).toBeInTheDocument();
    expect(profileRow).toMatchObject({ first_name: 'Wafa', last_name: 'Mohamed', gender: 'male' });
    expect(profileRow.email).toBe('customer@example.com'); // never sent
    expect(db.me.firstName).toBe('منى'); // the mock identity is not touched
    expect(main().getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('security: sessions, log out of other devices, wrong current password', async () => {
    const user = userEvent.setup();
    renderPortal('/app/account/security');
    expect(await main().findByText(/iPhone 15/)).toBeInTheDocument();
    await user.click(main().getByRole('button', { name: 'Log out of other devices' }));
    await waitFor(() => expect(main().queryByText(/iPhone 15/)).not.toBeInTheDocument());

    await user.type(main().getByLabelText(/Current password/, { selector: 'input' }), 'wrong');
    await user.type(main().getByLabelText(/^New password/, { selector: 'input' }), 'N3w!password');
    await user.type(
      main().getByLabelText(/^Confirm password/, { selector: 'input' }),
      'N3w!password',
    );
    await user.click(main().getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Invalid email/phone or password')).toBeInTheDocument();
  });

  it('notifications: security alerts are always on', async () => {
    const user = userEvent.setup();
    renderPortal('/app/account/notifications');
    const security = await main().findAllByRole('switch', { name: /Account & security alerts/ });
    security.forEach((toggle) => expect(toggle).toBeDisabled());
    const news = main().getByRole('switch', { name: 'News & promotions · Email' });
    await user.click(news);
    await waitFor(() => expect(db.prefs.news.email).toBe(true));
  });

  it('addresses: add (validated) and delete', async () => {
    const user = userEvent.setup();
    renderPortal('/app/account/addresses');
    await main().findAllByText('المنزل');
    await user.click(main().getByRole('button', { name: 'Add address' }));
    const dialog = screen.getByRole('dialog', { name: 'Add address' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getAllByText('This field is required').length).toBeGreaterThan(2);
    await user.type(within(dialog).getByLabelText(/^Label/), 'Office');
    await user.selectOptions(within(dialog).getByLabelText(/Governorate/), 'alexandria');
    await user.type(within(dialog).getByLabelText(/City/), 'Smouha');
    await user.type(within(dialog).getByLabelText(/Street/), '10 Victor Emmanuel St');
    await user.type(within(dialog).getByLabelText(/Contact phone/), '1012345678');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect((await main().findAllByText('Office')).length).toBeGreaterThan(0);
    await user.click(main().getAllByRole('button', { name: /Delete Office/ })[0]!);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(main().queryAllByText('Office')).toHaveLength(0));
  });

  it('preferences: date format applies everywhere; delete account needs DELETE', async () => {
    const user = userEvent.setup();
    renderPortal('/app/account/preferences');
    await user.selectOptions(await main().findByLabelText(/Date format/), 'ymd');
    expect(main().getByText(/Example: \d{4}-\d{2}-\d{2}/)).toBeInTheDocument();
    expect(localStorage.getItem('mirhalgo.dateFormat')).toBe('ymd');

    document.body.innerHTML = '';
    renderPortal('/app/account/privacy');
    await user.click(await main().findByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });
    await user.type(within(dialog).getByLabelText(/Type DELETE/), 'delete');
    await user.type(
      within(dialog).getByLabelText(/^Password/, { selector: 'input' }),
      'Str0ng!pass',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    expect(within(dialog).getByText('Type DELETE in capital letters')).toBeInTheDocument();
  });
});

describe('notifications & support (B7, B8)', () => {
  it('notifications page: unread filter and links to the order', async () => {
    const user = userEvent.setup();
    renderPortal('/app/notifications');
    await main().findAllByText(/New offer on your request/);
    await user.click(main().getByRole('tab', { name: /Unread/ }));
    expect(main().getAllByRole('link')).toHaveLength(3);
    expect(main().getAllByRole('link')[0]).toHaveAttribute('href', '/app/orders/ord_118');
  });

  it('FAQ search, new ticket (validated) → conversation, reply', async () => {
    const user = userEvent.setup();
    const router = renderPortal('/app/support');
    await user.type(
      await main().findByRole('searchbox', { name: 'Search the questions' }),
      'anonymous',
    );
    expect(main().getByText('Why are offers anonymous?')).toBeInTheDocument();
    expect(main().queryByText('How do I pay?')).not.toBeInTheDocument();

    await user.click(main().getByRole('button', { name: 'New ticket' }));
    const dialog = screen.getByRole('dialog', { name: 'New ticket' });
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(within(dialog).getAllByText('This field is required').length).toBeGreaterThan(1);
    await user.type(within(dialog).getByLabelText(/^Subject/), 'Late delivery');
    await user.selectOptions(within(dialog).getByLabelText(/^Category/), 'order');
    await user.type(within(dialog).getByLabelText(/^Message/), 'My shipment is two days late.');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/app\/support\/tickets\/tk_/),
    );
    expect(await main().findByText('My shipment is two days late.')).toBeInTheDocument();

    await user.type(main().getByLabelText(/Your reply/), 'Any update please?');
    await user.click(main().getByRole('button', { name: 'Send' }));
    expect(await main().findByText('Any update please?')).toBeInTheDocument();
  });
});
