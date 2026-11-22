import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Download, Printer } from 'lucide-react';
import { Button, Modal, buttonClasses } from '../../../components/ui';

/**
 * Shown after a request is sent (spec B3: "ready for later", used by the service forms in a
 * later plan): reference number, assigned companies, Print, Download, View my orders.
 */
export function RequestSuccessModal({
  reference,
  companies,
  onClose,
}: {
  reference: string;
  companies: string[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const names = companies.length
    ? new Intl.ListFormat(i18n.language).format(companies)
    : t('portal.success.allMatching');

  const download = () => {
    const text = [
      `${t('portal.success.reference')}: ${reference}`,
      `${t('portal.success.companies')}: ${names}`,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: `${reference}.txt`,
    });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      title={t('portal.success.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" />
            {t('portal.success.print')}
          </Button>
          <Button variant="secondary" shape="form" onClick={download}>
            <Download aria-hidden="true" className="size-4" />
            {t('portal.success.download')}
          </Button>
          <Link to="/app/orders" className={buttonClasses({ shape: 'form' })} data-autofocus>
            {t('portal.success.viewOrders')}
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <CircleCheck aria-hidden="true" className="size-12 text-success" />
        <p className="text-body">{t('portal.success.text')}</p>
        <p className="text-caption text-muted">{t('portal.success.reference')}</p>
        <p dir="ltr" className="font-mono text-h3 text-blue-600">
          {reference}
        </p>
        <p className="text-small text-body">
          {t('portal.success.companies')}:{' '}
          <span className="font-semibold text-heading">{names}</span>
        </p>
      </div>
    </Modal>
  );
}
