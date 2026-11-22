import { useEffect, useState } from 'react';

/**
 * Id of the section crossing the middle of the viewport, for the active nav link
 * (spec 3.1, IntersectionObserver). Null while above the first section (hero).
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
          else if (entry.target.id === ids[0] && entry.boundingClientRect.top > 0) setActive(null);
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
