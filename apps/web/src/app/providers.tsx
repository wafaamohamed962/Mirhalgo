import { useState, type ReactNode } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ApiRequestError } from '../lib/apiClient';
import { ConfigError } from '../lib/env';

/** API/config errors are shown to the user; anything else is a bug, so keep it in the console. */
const logUnexpected = (error: Error) => {
  if (!(error instanceof ApiRequestError || error instanceof ConfigError)) console.error(error);
};

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: logUnexpected }),
    mutationCache: new MutationCache({ onError: logUnexpected }),
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
      // never retry auth/contact mutations automatically (OTP attempts, rate limits)
      mutations: { retry: false },
    },
  });
}

/** App-wide providers (spec 8.3): TanStack Query + Auth. i18n is initialised in main.tsx. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
