import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { PageLoader } from '../components/layout/PageLoader';
import {
  GuestRoute,
  HomeRedirect,
  PendingVerificationRoute,
  ProtectedRoute,
} from '../features/auth/guards';
import type { PortalHandle } from '../features/portal/layout/nav';
import { RootLayout } from './RootLayout';

/** Route-level code splitting (spec 8.2, 8.5): every page is its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** A customer-portal page: lazy chunk + its top-bar title (MW_002 B9). */
const portal = (path: string, title: string, load: () => Promise<{ default: ComponentType }>) => ({
  path,
  lazy: page(load),
  handle: { title } satisfies PortalHandle,
});

/** Routes and access rules (spec 8.2 + MW_002 B9). */
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
            path: '/signup/company',
            lazy: page(
              () => import('../features/companyRegistration/pages/CompanyRegistrationPage'),
            ),
          },
          {
            path: '/forgot-password',
            lazy: page(() => import('../features/auth/pages/ForgotPasswordPage')),
          },
        ],
      },
      {
        path: '/signup/company/submitted',
        lazy: page(() => import('../features/companyRegistration/pages/ApplicationSubmittedPage')),
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
        children: [{ path: '/dashboard', element: <HomeRedirect /> }],
      },
      {
        // customer portal (MW_002 B9): verified customers only
        element: <ProtectedRoute allow={['customer']} />,
        children: [
          {
            path: '/app',
            lazy: async () => ({
              Component: (await import('../features/portal/layout/PortalLayout')).PortalLayout,
            }),
            children: [
              { index: true, element: <Navigate to="new-request" replace /> },
              portal(
                'new-request',
                'newRequest',
                () => import('../features/portal/requests/NewRequestPage'),
              ),
              portal(
                'new-request/:service',
                'newRequest',
                () => import('../features/portal/requests/ServicePlaceholderPage'),
              ),
              portal('orders', 'orders', () => import('../features/portal/orders/OrdersPage')),
              portal(
                'orders/:id',
                'portal.orders.detailTitle',
                () => import('../features/portal/orders/OrderDetailsPage'),
              ),
              portal(
                'companies',
                'companies',
                () => import('../features/portal/companies/CompaniesPage'),
              ),
              portal(
                'companies/:id',
                'portal.companies.profileTitle',
                () => import('../features/portal/companies/CompanyProfilePage'),
              ),
              portal(
                'account/:section?',
                'account',
                () => import('../features/portal/account/AccountPage'),
              ),
              portal(
                'notifications',
                'notifications',
                () => import('../features/portal/notifications/NotificationsPage'),
              ),
              portal('support', 'support', () => import('../features/portal/support/SupportPage')),
              portal(
                'support/tickets/:id',
                'portal.support.ticketTitle',
                () => import('../features/portal/support/TicketPage'),
              ),
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute allow={['company']} />,
        children: [
          {
            path: '/application-status',
            lazy: page(() => import('../features/companyPortal/ApplicationStatusPage')),
          },
        ],
      },
      { path: '*', lazy: page(() => import('../pages/NotFoundPage')) },
    ],
  },
]);
