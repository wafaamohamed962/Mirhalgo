import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../components/layout/Reveal';
import { Section, SectionHeader } from '../components/layout/Section';
import { Badge, cardClasses } from '../components/ui';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { IMAGES } from '../lib/images';

const SERVICES = [
  { id: 'international', hasBadge: true },
  { id: 'domestic', hasBadge: false },
  { id: 'china', hasBadge: true },
] as const;

/** Services (spec 3.4, screenshot 2): 3 large cards, stacked on mobile. */
export function Services() {
  const { t } = useTranslation();
  const { isVerified } = useAuth();

  return (
    <Section id="services">
      <SectionHeader
        sectionId="services"
        eyebrow={t('services.eyebrow')}
        title={t('services.title')}
      />

      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {SERVICES.map(({ id, hasBadge }, index) => {
          const key = `services.items.${id}`;
          const title = t(`${key}.title`);
          return (
            <li key={id}>
              <Reveal delay={index * 0.1} className="h-full">
                <article
                  className={cardClasses({
                    interactive: true,
                    className:
                      'group relative flex h-full flex-col overflow-hidden focus-within:shadow-lg',
                  })}
                >
                  <div className="relative h-56 shrink-0 overflow-hidden sm:h-64">
                    <ResponsiveImage
                      image={IMAGES[id]}
                      alt={t(`${key}.imageAlt`)}
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="size-full transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                    {hasBadge && (
                      <Badge className="absolute start-4 top-4 shadow-md">
                        {t(`${key}.badge`)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-6">
                    <h3 className="text-h3">
                      {/* stretched link: whole card clickable → signup, or dashboard if logged in (spec 3.4) */}
                      <Link
                        to={isVerified ? '/dashboard' : `/signup?service=${id}`}
                        aria-label={t('services.cta', { service: title })}
                        className="text-heading no-underline after:absolute after:inset-0 after:content-['']"
                      >
                        {title}
                      </Link>
                    </h3>
                    <p className="text-body">{t(`${key}.description`)}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                      <Badge variant="chip">{t(`${key}.tag`)}</Badge>
                      <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors duration-200 group-hover:bg-blue-700"
                      >
                        <ArrowRight className="size-5 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
