import { Navigate, Outlet } from 'react-router';
import type { UserRole } from '@mirhalgo/shared';
import { PageLoader } from '../../components/layout/PageLoader';
import { useAuth } from './hooks/useAuth';
import { getPendingVerification } from './pendingVerification';
import { homePath } from './roles';

/** The home of the logged-in account (role + company status). */
function useHome() {
  const { role, companyStatus } = useAuth();
  return homePath(role, companyStatus);
}

/**
 * Needs a session AND a verified email (spec 4.5). With `allow`, only these roles get in;
 * other roles go to their own home, so a company can never open the customer portal and a
 * customer never the company portal (MW_002 A6, MW_004 A1).
 */
export function ProtectedRoute({ allow }: { allow?: readonly UserRole[] }) {
  const { loading, isVerified, signedOut, role } = useAuth();
  const home = useHome();
  if (loading) return <PageLoader />;
  // logout → `/` (spec 4.5); anyone else without a verified session → /login
  if (!isVerified) return <Navigate to={signedOut ? '/' : '/login'} replace />;
  if (allow && (!role || !allow.includes(role))) return <Navigate to={home} replace />;
  return <Outlet />;
}

/**
 * Inside the company routes (MW_004 A1): `approved` companies get the portal pages, every
 * other status only the application status page. The wrong side → the company's own home.
 */
export function CompanyStatusRoute({ approved }: { approved: boolean }) {
  const { companyStatus } = useAuth();
  const home = useHome();
  return (companyStatus === 'approved') === approved ? <Outlet /> : <Navigate to={home} replace />;
}

/** /login, /signup, /forgot-password: logged-in users go to their home (spec 4.5). */
export function GuestRoute() {
  const { loading, isVerified } = useAuth();
  const home = useHome();
  if (loading) return <PageLoader />;
  return isVerified ? <Navigate to={home} replace /> : <Outlet />;
}

/** /verify-email: only while an account is waiting for its code (spec 8.2). */
export function PendingVerificationRoute() {
  const { loading, isVerified } = useAuth();
  const home = useHome();
  if (loading) return <PageLoader />;
  if (isVerified) return <Navigate to={home} replace />;
  return getPendingVerification() ? <Outlet /> : <Navigate to="/login" replace />;
}

/** /dashboard (MW_001 URL): redirects to the home of the logged-in account. */
export function HomeRedirect() {
  return <Navigate to={useHome()} replace />;
}
