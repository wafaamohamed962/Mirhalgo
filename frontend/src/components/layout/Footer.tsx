import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import logo from '../../assets/images/logo/mirhalgo-logo.svg';
import { ComingSoon } from '../ui/ComingSoon';
import { Container } from './Container';
import { SectionLink } from './SectionLink';
import { SocialLinks } from './SocialLinks';

const linkClass = 'text-body no-underline transition-colors duration-150 hover:text-blue-600';

/** Footer (spec 3.6): light blue → violet gradient, 3 columns, dynamic year. */
export function Footer() {
  const { t, i18n } = useTranslation();
  // generated, never hard-coded; formatted per locale without grouping ("2026", "٢٠٢٦")
  const year = new Intl.NumberFormat(i18n.language, { useGrouping: false }).format(
    new Date().getFullYear(),
  );

  return (
    <footer className="bg-(image:--gradient-footer)">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col items-start gap-4">
          <img src={logo} alt={t('common.brand')} width={70} height={65} className="h-16 w-auto" />
          <p className="text-h3 font-extrabold text-heading">
            {t('common.brand')} / {t('footer.brand')}
          </p>
          <p className="max-w-xs text-body">{t('footer.tagline')}</p>
        </div>

        <nav aria-labelledby="footer-links">
          <h2 id="footer-links" className="mb-4 text-h3">
            {t('footer.quickLinks')}
          </h2>
          <ul className="flex flex-col gap-3">
            <li>
              <SectionLink section="about" className={linkClass}>
                {t('nav.about')}
              </SectionLink>
            </li>
            <li>
              <SectionLink section="services" className={linkClass}>
                {t('nav.services')}
              </SectionLink>
            </li>
            <li>
              <Link to="/signup/company" className={linkClass}>
                {t('footer.joinCompany')}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="mb-4 text-h3">{t('footer.contactUs')}</h2>
          <SocialLinks />
        </div>
      </Container>

      <Container>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-6 text-small text-body sm:flex-row">
          <p>{t('footer.rights', { year })}</p>
          <ul className="flex gap-4">
            <li>
              <ComingSoon label={t('footer.privacy')}>{t('footer.privacy')}</ComingSoon>
            </li>
            <li>
              <ComingSoon label={t('footer.terms')}>{t('footer.terms')}</ComingSoon>
            </li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
