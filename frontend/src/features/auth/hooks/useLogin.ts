import { useMutation } from '@tanstack/react-query';
import type { LoginInput } from '@mirhalgo/shared';
import { authApi } from '../api';
import { useAuth } from './useAuth';

/**
 * POST /api/auth/login, then stores the returned session with supabase.auth.setSession
 * (spec 4.4). Used by the login page and by the auto-login after email verification.
 */
export function useLogin() {
  const { signIn } = useAuth();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const result = await authApi.login(input);
      if (result.status === 'authenticated') await signIn(result.session);
      return result;
    },
  });
}
