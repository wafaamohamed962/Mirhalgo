import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { PageLoader } from '../components/layout/PageLoader';
import { GuestRoute, PendingVerificationRoute, ProtectedRoute } from '../features/auth/guards';
import { RootLayout } from './RootLayout';

/** Route-level code splitting (spec 8.2, 8.5): every page is its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** Routes and access rules (spec 8.2). */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    HydrateFallback: PageLoader,
    children: [
      { path: '/', lazy: page(() => import('../pages/LandingPage')) },
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', lazy: page(() => import('../features/auth/pages/LoginPage')) },
          { path: '/signup', lazy: page(() => import('../features/auth/pages/SignupRolePage')) },
          {
            path: '/signup/customer',
            lazy: page(() => import('../features/auth/pages/SignupCustomerPage')),
          },
          {
            path: '/forgot-password',
            lazy: page(() => import('../features/auth/pages/ForgotPasswordPage')),
          },
        ],
      },
      {
        path: '/signup/company',
        lazy: page(() => import('../features/auth/pages/CompanyComingSoonPage')),
      },
      {
        element: <PendingVerificationRoute />,
        children: [
          {
            path: '/verify-email',
            lazy: page(() => import('../features/auth/pages/VerifyEmailPage')),
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', lazy: page(() => import('../pages/DashboardPage')) }],
      },
      { path: '*', lazy: page(() => import('../pages/NotFoundPage')) },
    ],
  },
]);
