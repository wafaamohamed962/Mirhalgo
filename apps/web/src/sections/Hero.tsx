import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Container } from '../components/layout/Container';
import { SectionLink } from '../components/layout/SectionLink';
import { buttonClasses } from '../components/ui';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { IMAGES } from '../lib/images';
import { HeroRoutes } from './HeroRoutes';

/** Full-viewport hero: logistics background + navy overlay + CTAs (spec 3.2, screenshot 1). */
export function Hero() {
  const { t } = useTranslation();

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-dvh items-center overflow-hidden bg-navy-900"
    >
      <ResponsiveImage
        image={IMAGES.hero}
        alt={t('hero.imageAlt')}
        sizes="100vw"
        priority
        className="absolute inset-0 -z-20 size-full"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-(image:--gradient-hero) rtl:bg-(image:--gradient-hero-rtl)"
      />
      {/* after the overlay (same z-layer) so it paints above it, still behind the text */}
      <HeroRoutes />

      <Container className="pt-(--navbar-height) pb-16">
        <div className="max-w-2xl">
          <p className="mb-4 text-small font-semibold tracking-widest text-violet-100 uppercase">
            {t('hero.eyebrow')}
          </p>
          <h1 id="hero-title" className="text-display text-white">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-xl text-base text-on-dark-muted md:text-h3 md:font-normal">
            {t('hero.subtitle')}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/signup" className={buttonClasses({ className: 'px-8' })}>
              {t('hero.cta')}
            </Link>
            <SectionLink
              section="services"
              className={buttonClasses({ variant: 'onDark', className: 'px-8' })}
            >
              {t('hero.secondaryCta')}
            </SectionLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
