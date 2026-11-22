import type { IconType } from 'react-icons';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';

/** Landing-page sections linked from the navbar, drawer and footer (spec 3.1). */
export const SECTION_IDS = ['about', 'services', 'contact'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type SocialLink = {
  id: 'facebook' | 'whatsapp' | 'instagram';
  /** Undefined = inactive placeholder (Instagram: "Coming soon"). */
  href?: string;
  icon: IconType;
  /** Brand background (spec 3.5: icons keep their brand colors). */
  brandClass: string;
};

/** Social links (spec 3.5). */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    id: 'facebook',
    href: 'https://www.facebook.com/share/1Co23xssyX/',
    icon: FaFacebookF,
    brandClass: 'bg-facebook',
  },
  {
    id: 'instagram',
    icon: FaInstagram,
    brandClass: 'bg-(image:--brand-instagram)',
  },
  {
    id: 'whatsapp',
    href: 'https://wa.me/201207240825',
    icon: FaWhatsapp,
    brandClass: 'bg-whatsapp',
  },
];

/** Smooth scroll is set in CSS (and disabled for reduced motion). */
export function scrollToTop() {
  window.scrollTo({ top: 0 });
}

/**
 * Scrolls to a landing section (offset by its scroll-margin-top) and updates the hash.
 * replaceState (not a native hash jump) avoids a router POP navigation, whose scroll
 * restoration would cancel the smooth scroll. Keeps React Router's history.state.
 */
export function scrollToSection(id: SectionId) {
  document.getElementById(id)?.scrollIntoView();
  window.history.replaceState(window.history.state, '', `#${id}`);
}
