import { screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCompany, resetCompanyMocks, server } from './renderCompany';

/* Production build (no VITE_DEMO_TOOLS): no demo tools in the settings (spec B1, B9). */

vi.mock('../../src/lib/env', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/lib/env')>();
  return { ...original, flags: { ...original.flags, demoTools: false } };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetCompanyMocks();
  localStorage.clear();
});

describe('demo tools flag off', () => {
  it('the settings have no demo tools, no reset and no suspension switch', async () => {
    renderCompany('/company/settings');
    expect(await screen.findByRole('region', { name: 'Password' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Demo tools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Simulate/ })).not.toBeInTheDocument();
  });
});
