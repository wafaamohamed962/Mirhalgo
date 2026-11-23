import type { ReactNode } from 'react';
import { SimpleLayout } from '../../../components/layout/SimpleLayout';
import { Card } from '../../../components/ui';
import { ServiceNotice } from '../../../components/ui/ServiceNotice';

/** Shared shell of every auth page: light layout + centered card with title/subtitle. */
export function AuthCard({
  title,
  subtitle,
  footer,
  wide = false,
  needsBackend = true,
  backHome = false,
  back = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Wider card for the sign-up form. */
  wide?: boolean;
  /** Show the "not configured" notice when API/Supabase variables are missing. */
  needsBackend?: boolean;
  /** "Back to home" in the header (sign-up forms, MW_003 A3). */
  backHome?: boolean;
  /** "Back" under the header: the previous page, else the logical parent. */
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <SimpleLayout backHome={backHome} back={back}>
      <Card className={wide ? 'w-full max-w-2xl p-6 sm:p-10' : 'w-full max-w-md p-6 sm:p-8'}>
        <header className="mb-6 text-center">
          <h1 className="text-h2">{title}</h1>
          {subtitle && <p className="mt-2 text-body">{subtitle}</p>}
        </header>
        <div className="flex flex-col gap-5">
          {needsBackend && <ServiceNotice needs="auth" />}
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-small text-body">{footer}</div>}
      </Card>
    </SimpleLayout>
  );
}
