import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Container } from './Container';

type SectionTone = 'white' | 'slate' | 'blue';

const TONES: Record<SectionTone, string> = {
  white: 'bg-white',
  slate: 'bg-slate-50',
  blue: 'bg-blue-50',
};

/** Id of the section heading, used by `aria-labelledby`. */
const sectionTitleId = (id: string) => `${id}-title`;

/** Landing-page section: 64/96px vertical padding, offset for the sticky navbar (spec 3.1, 2.5). */
export function Section({
  id,
  tone = 'white',
  children,
}: {
  /** Anchor target for the navbar (#about, #services, #contact). */
  id: string;
  tone?: SectionTone;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={sectionTitleId(id)}
      className={cn('scroll-mt-(--navbar-height) py-(--section-py)', TONES[tone])}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Eyebrow + h2 + optional subtitle. Pass the section id so the heading labels it. */
export function SectionHeader({
  sectionId,
  eyebrow,
  title,
  subtitle,
  align = 'center',
  spaced = true,
}: {
  sectionId: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'center' | 'start';
  /** Bottom margin before the section content. */
  spaced?: boolean;
}) {
  return (
    <header
      className={cn(
        'max-w-2xl',
        spaced && 'mb-10 md:mb-14',
        align === 'center' ? 'mx-auto text-center' : 'text-start',
      )}
    >
      {eyebrow && (
        <p className="mb-2 text-small font-semibold tracking-wide text-violet-600 uppercase">
          {eyebrow}
        </p>
      )}
      <h2 id={sectionTitleId(sectionId)} className="text-h2">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base text-body">{subtitle}</p>}
    </header>
  );
}
