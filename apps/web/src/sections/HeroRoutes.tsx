import { Plane, Ship, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

/*
 * Calm "shipping routes" background for the hero (ADDITION beyond the MW_001 spec,
 * see CLAUDE.md). Pure inline SVG + CSS: dashes flow via stroke-dashoffset, icons move
 * via CSS offset-path. Decorative only: aria-hidden, pointer-events none, behind text.
 * Mobile (< sm, also Lighthouse's viewport): static routes, no icons, no animation.
 * prefers-reduced-motion: fully static (motion-safe only).
 */

/** Routes in a 1440×900 viewBox (scaled with `slice`, so they always cover the hero). */
const ROUTES = {
  air: 'M -40 600 C 360 140, 900 40, 1480 170',
  middle: 'M -40 760 C 420 560, 980 700, 1480 430',
  sea: 'M -40 860 C 420 770, 1000 900, 1480 740',
} as const;

type RouteName = keyof typeof ROUTES;

const LINES: ReadonlyArray<{ route: RouteName; color: string; opacity: number; mobile: boolean }> =
  [
    { route: 'air', color: 'text-sky-400', opacity: 0.3, mobile: true },
    { route: 'middle', color: 'text-blue-600', opacity: 0.25, mobile: false },
    { route: 'sea', color: 'text-sky-400', opacity: 0.2, mobile: true },
  ];

const TRAVELLERS: ReadonlyArray<{ route: RouteName; icon: LucideIcon; delay: string }> = [
  { route: 'air', icon: Plane, delay: '0s' },
  { route: 'sea', icon: Ship, delay: '-12s' }, // out of sync with the plane
];

const ICON_SIZE = 28;

export function HeroRoutes() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 size-full rtl:-scale-x-100"
    >
      {LINES.map(({ route, color, opacity, mobile }) => (
        <path
          key={route}
          d={ROUTES[route]}
          fill="none"
          stroke="currentColor"
          strokeOpacity={opacity}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="2 12"
          className={cn(color, !mobile && 'max-sm:hidden', 'sm:motion-safe:animate-route-dash')}
        />
      ))}

      {TRAVELLERS.map(({ route, icon: Icon, delay }) => (
        <g
          key={route}
          className="text-sky-400 motion-safe:animate-route-travel motion-reduce:opacity-0 max-sm:hidden"
          style={{
            offsetPath: `path('${ROUTES[route]}')`,
            offsetRotate: '0deg',
            animationDelay: delay,
          }}
        >
          <Icon
            x={-ICON_SIZE / 2}
            y={-ICON_SIZE / 2}
            width={ICON_SIZE}
            height={ICON_SIZE}
            strokeWidth={1.75}
            strokeOpacity={0.3}
          />
        </g>
      ))}
    </svg>
  );
}
