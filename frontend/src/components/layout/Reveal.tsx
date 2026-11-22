import type { ReactNode } from 'react';
import { m } from 'framer-motion';

/**
 * Subtle fade + slide when scrolled into view (spec 8.1: Framer Motion, on scroll only).
 * Needs a <LazyMotion> ancestor; reduced motion is respected by <MotionConfig reducedMotion="user">.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay }}
    >
      {children}
    </m.div>
  );
}
