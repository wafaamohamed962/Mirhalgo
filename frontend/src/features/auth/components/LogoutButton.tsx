import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useAuth } from '../hooks/useAuth';

/** Logout → `/` (spec 4.5: ProtectedRoute redirects there once the session is cleared). */
export function LogoutButton() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const logout = useMutation({ mutationFn: signOut });

  return (
    <Button
      variant="secondary"
      shape="form"
      loading={logout.isPending}
      onClick={() => logout.mutate()}
    >
      <LogOut aria-hidden="true" className="size-5 rtl:rotate-180" />
      {t('nav.logout')}
    </Button>
  );
}
