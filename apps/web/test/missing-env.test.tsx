import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Regression: with no apps/web/.env, supabase-js threw "supabaseUrl is required",
 * AuthProvider never finished loading and every guarded page (Sign Up, Login,
 * service cards) showed an endless spinner. Missing config must never block navigation.
 */

async function loadWithEnv(values: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
  return {
    env: await import('../src/lib/env'),
    api: await import('../src/lib/apiClient'),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('missing environment variables', () => {
  it('logs one clear message naming the missing variables', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { env } = await loadWithEnv({ VITE_SUPABASE_URL: '', VITE_API_URL: '' });
    env.reportMissingEnv();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('VITE_SUPABASE_URL');
    expect(error.mock.calls[0]?.[0]).toContain('VITE_API_URL');
    expect(error.mock.calls[0]?.[0]).not.toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('API calls fail with a translatable CONFIG_MISSING error instead of crashing', async () => {
    const { api } = await loadWithEnv({ VITE_API_URL: '' });
    const failure = await api.apiPost('/contact', {}).catch((e: unknown) => e);
    expect(api.errorKey(failure)).toBe('errors.CONFIG_MISSING');
  });

  it('guarded pages still render (no endless loader) and show the notice', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await loadWithEnv({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' });
    const { AuthProvider } = await import('../src/features/auth/AuthProvider');
    const { GuestRoute } = await import('../src/features/auth/guards');
    const { ServiceNotice } = await import('../src/components/ui/ServiceNotice');

    const router = createMemoryRouter(
      [
        {
          element: <GuestRoute />,
          children: [
            {
              path: '/signup',
              element: (
                <>
                  <h1>signup page</h1>
                  <ServiceNotice needs="auth" />
                </>
              ),
            },
          ],
        },
      ],
      { initialEntries: ['/signup'] },
    );
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'signup page' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('not fully configured');
  });
});
