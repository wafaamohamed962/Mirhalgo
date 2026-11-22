import type { AnchorHTMLAttributes } from 'react';
import { scrollToSection, type SectionId } from '../../lib/navigation';

type SectionLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  section: SectionId;
  /** Runs before scrolling, e.g. to close the mobile drawer. */
  onNavigate?: () => void;
};

/** In-page link to a landing section (#about, #services, #contact), smooth-scrolled (spec 3.1). */
export function SectionLink({ section, onNavigate, onClick, children, ...rest }: SectionLinkProps) {
  return (
    <a
      href={`/#${section}`}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
        onNavigate?.();
        // next frame: lets the drawer unmount and release its body scroll lock first
        requestAnimationFrame(() => scrollToSection(section));
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
