import { Outlet, ScrollRestoration } from 'react-router';
import { Toaster } from '../components/ui/Toast';

/** Top-level route element: page outlet, scroll restoration on navigation, toasts. */
export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
      <Toaster />
    </>
  );
}
