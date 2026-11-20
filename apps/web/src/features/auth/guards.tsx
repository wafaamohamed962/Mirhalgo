import { Navigate, Outlet } from 'react-router';
import { PageLoader } from '../../components/layout/PageLoader';
import { useAuth } from './hooks/useAuth';
import { getPendingVerification } from './pendingVerification';

/** /dashboard: needs a session AND a verified email (spec 4.5). */
export function ProtectedRoute() {
  const { loading, isVerified, signedOut } = useAuth();
  if (loading) return <PageLoader />;
  if (isVerified) return <Outlet />;
  // logout → `/` (spec 4.5); anyone else without a verified session → /login
  return <Navigate to={signedOut ? '/' : '/login'} replace />;
}

/** /login, /signup, /forgot-password: logged-in users go to /dashboard (spec 4.5). */
export function GuestRoute() {
  const { loading, isVerified } = useAuth();
  if (loading) return <PageLoader />;
  return isVerified ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

/** /verify-email: only while an account is waiting for its code (spec 8.2). */
export function PendingVerificationRoute() {
  const { loading, isVerified } = useAuth();
  if (loading) return <PageLoader />;
  if (isVerified) return <Navigate to="/dashboard" replace />;
  return getPendingVerification() ? <Outlet /> : <Navigate to="/login" replace />;
}
