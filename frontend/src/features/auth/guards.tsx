import { Navigate, Outlet } from 'react-router';
import type { UserRole } from '@mirhalgo/shared';
import { PageLoader } from '../../components/layout/PageLoader';
import { useAuth } from './hooks/useAuth';
import { getPendingVerification } from './pendingVerification';
import { homePath } from './roles';

/**
 * Needs a session AND a verified email (spec 4.5). With `allow`, only these roles get in;
 * other roles go to their own home, so a company can never open the customer portal
 * (MW_002 A6).
 */
export function ProtectedRoute({ allow }: { allow?: readonly UserRole[] }) {
  const { loading, isVerified, signedOut, role } = useAuth();
  if (loading) return <PageLoader />;
  // logout → `/` (spec 4.5); anyone else without a verified session → /login
  if (!isVerified) return <Navigate to={signedOut ? '/' : '/login'} replace />;
  if (allow && (!role || !allow.includes(role))) return <Navigate to={homePath(role)} replace />;
  return <Outlet />;
}

/** /login, /signup, /forgot-password: logged-in users go to their home (spec 4.5). */
export function GuestRoute() {
  const { loading, isVerified, role } = useAuth();
  if (loading) return <PageLoader />;
  return isVerified ? <Navigate to={homePath(role)} replace /> : <Outlet />;
}

/** /verify-email: only while an account is waiting for its code (spec 8.2). */
export function PendingVerificationRoute() {
  const { loading, isVerified, role } = useAuth();
  if (loading) return <PageLoader />;
  if (isVerified) return <Navigate to={homePath(role)} replace />;
  return getPendingVerification() ? <Outlet /> : <Navigate to="/login" replace />;
}

/** /dashboard (MW_001 URL): redirects to the home of the logged-in role. */
export function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={homePath(role)} replace />;
}
