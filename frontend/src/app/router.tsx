import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { PageLoader } from '../components/layout/PageLoader';
import {
  CompanyStatusRoute,
  GuestRoute,
  HomeRedirect,
  PendingVerificationRoute,
  ProtectedRoute,
} from '../features/auth/guards';
import { COMPANY_STATUS_PAGE } from '../features/auth/roles';
import type { PortalHandle } from '../features/portal/layout/nav';
import { RootLayout } from './RootLayout';

/** Route-level code splitting (spec 8.2, 8.5): every page is its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** A portal page (customer MW_002 B9, company MW_004): lazy chunk + its title. */
const portal = (path: string, title: string, load: () => Promise<{ default: ComponentType }>) => ({
  path,
  lazy: page(load),
  handle: { title } satisfies PortalHandle,
});

type Load = () => Promise<{ default: ComponentType }>;
const sectionPlaceholder: Load = () => import('../features/companyPortal/pages/SectionPage');

/**
 * The 6 company portal sections (MW_004 B11); each title is `companyPortal.nav.<path>`.
 * Sections whose page is not built yet (B5–B10) show SectionPage (title + Back).
 */
const COMPANY_SECTIONS: ReadonlyArray<[path: string, load: Load]> = [
  ['overview', () => import('../features/companyPortal/pages/OverviewPage')],
  ['requests', () => import('../features/companyPortal/pages/RequestsPage')],
  ['offers', () => import('../features/companyPortal/pages/OffersPage')],
  ['competitors', () => import('../features/companyPortal/pages/CompetitorsPage')],
  ['inquiries', () => import('../features/companyPortal/pages/InquiriesPage')],
  ['settings', sectionPlaceholder],
];

/** Routes and access rules (spec 8.2 + MW_002 B9 + MW_004 A1). */
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
                'new-request/success/:reference',
                'newRequest',
                () => import('../features/requests/RequestSuccessPage'),
              ),
              portal(
                'new-request/:service',
                'newRequest',
                () => import('../features/requests/RequestFormPage'),
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
        // company portal (MW_004): verified companies only; approved ones get the portal,
        // every other status only the application status page
        path: '/company',
        element: <ProtectedRoute allow={['company']} />,
        children: [
          {
            element: <CompanyStatusRoute approved />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              {
                lazy: async () => ({
                  Component: (await import('../features/companyPortal/layout/CompanyLayout'))
                    .CompanyLayout,
                }),
                children: COMPANY_SECTIONS.map(([path, load]) => portal(path, path, load)),
              },
            ],
          },
          {
            element: <CompanyStatusRoute approved={false} />,
            children: [
              {
                path: 'application-status',
                lazy: page(() => import('../features/companyPortal/pages/ApplicationStatusPage')),
              },
            ],
          },
        ],
      },
      // MW_002 URL of the status page (bookmarks): the guards above pick the right page
      { path: '/application-status', element: <Navigate to={COMPANY_STATUS_PAGE} replace /> },
      { path: '*', lazy: page(() => import('../pages/NotFoundPage')) },
    ],
  },
]);
