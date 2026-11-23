import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { AuthContext } from '../../features/auth/authContext';
import { backFallback } from '../../features/auth/roles';
import { hasInAppHistory } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { buttonClasses } from './styles';

/**
 * "Back" (addition beyond the MW_003 spec). With a previous page inside the app it goes back
 * exactly there (`navigate(-1)`: same URL and query string, scroll restored by
 * `ScrollRestoration`). Without one (an email link, a new tab) it goes to the page's logical
 * parent for this viewer (`backFallback`), replacing the entry, so it never offers a page the
 * user's role or auth state cannot open. A page with unsaved data still asks first: its
 * `useUnsavedChangesGuard` blocks this navigation like any other.
 */
export function BackButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // read directly (not useAuth): outside the provider the viewer is a guest
  const auth = useContext(AuthContext);
  // the fallback depends on the role: on an unguarded page (404, auth pages) wait for the
  // session (read just after the first paint) rather than treat a customer as a guest
  const waiting = Boolean(auth?.loading) && !hasInAppHistory();

  const goBack = () => {
    if (hasInAppHistory()) {
      void navigate(-1);
      return;
    }
    const viewer = { isVerified: auth?.isVerified ?? false, role: auth?.role ?? null };
    // replace: the browser's own Back should not return to the page that was just left
    void navigate(backFallback(pathname, viewer), { replace: true });
  };

  return (
    <button
      type="button"
      onClick={goBack}
      disabled={waiting}
      // the name contains the visible word (WCAG 2.5.3) and says where it goes
      aria-label={t('common.backLabel')}
      className={buttonClasses({
        variant: 'ghost',
        shape: 'form',
        className: cn('-ms-2 self-start text-small', className),
      })}
    >
      <ArrowLeft aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
      {t('common.back')}
    </button>
  );
}
