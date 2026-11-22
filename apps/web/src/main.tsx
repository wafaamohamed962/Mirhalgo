import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './i18n';
import './styles/globals.css';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { flags, reportMissingEnv } from './lib/env';

reportMissingEnv();

// Mock API for the customer portal (own chunk, only loaded when enabled, decision 17).
const mocksReady = flags.useMocks
  ? import('./mocks/browser').then(({ startMocks }) => startMocks())
  : Promise.resolve();

void mocksReady.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  ),
);
