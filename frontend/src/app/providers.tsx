import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthProvider';
import { useAuth } from '../features/auth/hooks/useAuth';
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

/**
 * Cached data belongs to one user (the portal shows the real profile): drop it all when the
 * signed-in user changes (logout, expired session, another account), so nobody sees the
 * previous user's name or data.
 */
function ClearCacheOnUserChange() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  const previous = useRef(userId);
  useEffect(() => {
    if (previous.current !== userId) queryClient.clear();
    previous.current = userId;
  }, [queryClient, userId]);
  return null;
}

/** App-wide providers (spec 8.3): TanStack Query + Auth. i18n is initialised in main.tsx. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClearCacheOnUserChange />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
