import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { buttonClasses } from '../../components/ui';

/** /app/new-request/success/:reference — the full confirmation card comes in B6. */
export default function RequestSuccessPage() {
  const { t } = useTranslation();
  const { reference } = useParams();
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg bg-white p-8 text-center shadow-md">
      <CheckCircle2 aria-hidden="true" className="size-14 text-success" />
      <h2 className="text-h2">{t('portal.request.success.title')}</h2>
      <p dir="ltr" className="text-h3 text-blue-600">
        {reference}
      </p>
      <Link to="/app/orders" className={buttonClasses({ shape: 'form' })}>
        {t('portal.request.success.viewOrders')}
      </Link>
    </section>
  );
}
