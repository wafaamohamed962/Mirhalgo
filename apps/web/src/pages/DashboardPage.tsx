import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { SimpleLayout } from '../components/layout/SimpleLayout';
import { Button, Card, Spinner } from '../components/ui';
import { useAuth } from '../features/auth/hooks/useAuth';
import { supabase } from '../lib/supabase';
import { usePageMeta } from '../lib/usePageMeta';

/** Own profile via RLS ("owner can read"), only the column we show. */
async function fetchFirstName(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.first_name as string;
}

/** /dashboard: placeholder for verified customers (spec 8.2). */
export default function DashboardPage() {
  const { t } = useTranslation();
  usePageMeta('dashboard');
  const { session, signOut } = useAuth();
  const userId = session?.user.id ?? '';

  const profile = useQuery({
    queryKey: ['profile', userId, 'first_name'],
    queryFn: () => fetchFirstName(userId),
    enabled: Boolean(userId),
  });

  // spec 4.5: logout → `/` (ProtectedRoute redirects there once the session is cleared)
  const logout = useMutation({ mutationFn: signOut });

  return (
    <SimpleLayout
      actions={
        <Button
          variant="secondary"
          shape="form"
          loading={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut aria-hidden="true" className="size-5 rtl:rotate-180" />
          {t('nav.logout')}
        </Button>
      }
    >
      <Card className="w-full max-w-2xl p-8 text-center sm:p-12">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <LayoutDashboard aria-hidden="true" className="size-8" />
        </span>
        <p className="mt-6 text-small font-semibold tracking-wide text-violet-600 uppercase">
          {t('auth.dashboard.title')}
        </p>
        <h1 className="mt-2 text-h2">
          {profile.isPending ? (
            <Spinner className="mx-auto size-8 text-blue-600" />
          ) : (
            t('auth.dashboard.welcome', { name: profile.data ?? session?.user.email })
          )}
        </h1>
        <p className="mt-4 text-body">{t('auth.dashboard.placeholder')}</p>
      </Card>
    </SimpleLayout>
  );
}
