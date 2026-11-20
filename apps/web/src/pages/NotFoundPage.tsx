import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SimpleLayout } from '../components/layout/SimpleLayout';
import { buttonClasses } from '../components/ui';
import { usePageMeta } from '../lib/usePageMeta';

export default function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta('notFound');

  return (
    <SimpleLayout>
      <div className="max-w-md text-center">
        <p className="text-display font-extrabold text-blue-600">{t('notFound.code')}</p>
        <h1 className="mt-2 text-h2">{t('notFound.title')}</h1>
        <p className="mt-3 text-body">{t('notFound.text')}</p>
        <Link to="/" className={buttonClasses({ className: 'mt-8' })}>
          {t('common.backHome')}
        </Link>
      </div>
    </SimpleLayout>
  );
}
