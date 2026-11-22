import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { cn } from '../../lib/utils';
import { buttonClasses } from '../ui/styles';

/**
 * Navbar end + mobile drawer (spec 3.1): Login (on-dark outline) + Sign Up (primary pill),
 * or a Dashboard link once logged in.
 */
export function NavActions({
  stacked = false,
  onNavigate,
}: {
  stacked?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { isVerified } = useAuth();
  const link = (to: string, label: string, variant?: 'onDark') => (
    <Link
      to={to}
      onClick={onNavigate}
      className={buttonClasses({ variant, fullWidth: stacked, className: 'px-5' })}
    >
      {label}
    </Link>
  );

  return (
    <div className={cn('flex gap-3', stacked ? 'flex-col' : 'items-center')}>
      {isVerified ? (
        link('/dashboard', t('nav.dashboard'))
      ) : (
        <>
          {link('/login', t('nav.login'), 'onDark')}
          {link('/signup', t('nav.signup'))}
        </>
      )}
    </div>
  );
}
