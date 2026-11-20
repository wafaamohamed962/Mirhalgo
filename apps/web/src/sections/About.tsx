import { useTranslation } from 'react-i18next';
import { BadgePercent, Handshake, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import { Reveal } from '../components/layout/Reveal';
import { Section, SectionHeader } from '../components/layout/Section';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { IMAGES } from '../lib/images';

const FEATURES: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'verified', icon: Handshake },
  { key: 'quotes', icon: BadgePercent },
  { key: 'protected', icon: ShieldCheck },
  { key: 'support', icon: Truck },
];

/** About (spec 3.3): text + image, then 4 feature tiles. */
export function About() {
  const { t } = useTranslation();

  return (
    <Section id="about" tone="slate">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <SectionHeader
            sectionId="about"
            align="start"
            spaced={false}
            eyebrow={t('about.eyebrow')}
            title={t('about.title')}
            subtitle={t('about.body')}
          />
        </Reveal>
        <Reveal delay={0.1}>
          <ResponsiveImage
            image={IMAGES.about}
            alt={t('about.imageAlt')}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-4/3 w-full rounded-lg shadow-md"
          />
        </Reveal>
      </div>

      <ul className="mt-12 grid grid-cols-2 gap-4 md:mt-16 lg:grid-cols-4 lg:gap-6">
        {FEATURES.map(({ key, icon: Icon }, index) => (
          <li key={key}>
            <Reveal delay={index * 0.05} className="h-full">
              <div className="flex h-full flex-col items-center gap-3 rounded-lg bg-white p-5 text-center shadow-md sm:p-6">
                <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <p className="text-base font-semibold text-heading">{t(`about.features.${key}`)}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
