import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderRecord } from '@mirhalgo/shared';
import { apiState, orderRecords, renderPortal, resetPortalDb, server } from './renderPortal';

/* MW_003 B6: the success screen reads the order from the API (refresh-safe), print, PDF. */

const { downloadElementAsPdf } = vi.hoisted(() => ({
  downloadElementAsPdf: vi.fn<(element: HTMLElement, fileName: string) => Promise<void>>(),
}));
vi.mock('../../src/lib/downloadPdf', () => ({ downloadElementAsPdf }));

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetPortalDb();
  apiState.drafts = [];
  apiState.balance = { remaining: 2, total: 5 };
  downloadElementAsPdf.mockReset();
  downloadElementAsPdf.mockResolvedValue(undefined);
});
afterAll(() => server.close());

const main = () => within(screen.getByRole('main'));

function plant(service: OrderRecord['service'], reference = 'MG1042') {
  orderRecords[reference] = {
    reference,
    service,
    status: 'under_review',
    submittedAt: '2026-11-23T10:30:00Z',
    order: {},
    derived: { items: [], totalContainers: null, totalTrucks: null, totalCbm: null },
    attachments: [],
  };
}

describe('Request success page (B6)', () => {
  it('opened directly (reload / shared link): reference, service, date, status, balance', async () => {
    plant('international');
    renderPortal('/app/new-request/success/MG1042');
    expect(await main().findByText('MG1042')).toBeInTheDocument();
    expect(main().getByText('Our team will contact you as soon as possible.')).toBeInTheDocument();
    expect(main().getByText('International Shipping & Customs')).toBeInTheDocument();
    expect(main().getByText('Under review')).toBeInTheDocument();
    expect(main().getByText(/^23\/11\/2026/)).toBeInTheDocument();
    expect(await main().findByText('2 of 5')).toBeInTheDocument();
    expect(main().getByRole('link', { name: 'View my orders' })).toHaveAttribute(
      'href',
      '/app/orders',
    );
  });

  it('the China form has its own message', async () => {
    plant('china');
    renderPortal('/app/new-request/success/MG1042');
    expect(await main().findByText('We will reply within 24 working hours.')).toBeInTheDocument();
  });

  it('an unknown (or another customer’s) reference: not found, no card', async () => {
    renderPortal('/app/new-request/success/MG9999');
    expect(await main().findByRole('alert')).toHaveTextContent('This request was not found.');
    expect(main().queryByRole('button', { name: /Print/ })).not.toBeInTheDocument();
    expect(main().getByRole('link', { name: 'View my orders' })).toBeInTheDocument();
  });

  it('Print prints the page; Download PDF captures the card, with an error when it fails', async () => {
    plant('domestic');
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPortal('/app/new-request/success/MG1042');
    await main().findByText('MG1042');

    await user.click(main().getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();

    await user.click(main().getByRole('button', { name: 'Download PDF' }));
    expect(downloadElementAsPdf).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'MirhalGo-MG1042.pdf',
    );
    const card = downloadElementAsPdf.mock.calls[0]![0];
    expect(card).toHaveTextContent('MG1042');
    expect(card).not.toHaveTextContent('Download PDF'); // the buttons are not in the PDF

    downloadElementAsPdf.mockRejectedValueOnce(new Error('canvas'));
    await user.click(main().getByRole('button', { name: 'Download PDF' }));
    expect(await main().findByRole('alert')).toHaveTextContent('The PDF could not be created');
    print.mockRestore();
  });
});
