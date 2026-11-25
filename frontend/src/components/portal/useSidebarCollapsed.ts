import { useState } from 'react';

const COLLAPSED_KEY = 'mirhalgo.sidebarCollapsed';

/** Desktop: expanded unless the user collapsed it. Tablet: collapsed by default (MW_002 B1). */
function initialCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // ignore
  }
  return window.matchMedia?.('(max-width: 1279px)').matches ?? false;
}

/** The sidebar state of both portals, remembered on this device. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () =>
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!value));
      } catch {
        // ignore
      }
      return !value;
    });
  return [collapsed, toggle] as const;
}
