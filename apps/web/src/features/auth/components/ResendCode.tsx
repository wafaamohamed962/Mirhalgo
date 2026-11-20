import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { OtpSentResult } from '@mirhalgo/shared';
import { Button } from '../../../components/ui';
import { errorKey } from '../../../lib/apiClient';
import { useCountdown } from '../../../lib/useCountdown';

/** "Resend code" with the 60-second countdown (spec 4.3). */
export function ResendCode({
  initialCooldown,
  send,
}: {
  initialCooldown: number;
  send: () => Promise<OtpSentResult>;
}) {
  const { t } = useTranslation();
  const { remaining, restart } = useCountdown(initialCooldown);

  const resend = useMutation({
    mutationFn: send,
    onSuccess: (result) => {
      restart(result.cooldownSeconds);
      toast.success(t('auth.verify.resent'));
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });

  return (
    <Button
      variant="ghost"
      shape="form"
      disabled={remaining > 0}
      loading={resend.isPending}
      onClick={() => resend.mutate()}
    >
      {remaining > 0 ? t('auth.verify.resendIn', { seconds: remaining }) : t('auth.verify.resend')}
    </Button>
  );
}
