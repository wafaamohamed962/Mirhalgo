import { Globe, Plane, Ship, ShoppingBag, Truck, Van, type LucideIcon } from 'lucide-react';
import type { ServiceCategory } from '@mirhalgo/shared';
import { cn } from '../../lib/utils';

/*
 * The category system (MW_004 spec B2), used in every list: an icon, a tile / chip colour
 * and a side stripe, all from tokens.css (contrast checked there). lucide has no "fast truck":
 * international land is the truck, domestic land the van (plan Q9).
 */
export const CATEGORY_LOOK: Record<
  ServiceCategory,
  { icon: LucideIcon; tone: string; stripe: string }
> = {
  sea: { icon: Ship, tone: 'bg-blue-50 text-blue-700', stripe: 'border-s-blue-600' },
  international_land: {
    icon: Truck,
    tone: 'bg-amber-100 text-amber-800',
    stripe: 'border-s-warning',
  },
  domestic_land: { icon: Van, tone: 'bg-amber-50 text-amber-800', stripe: 'border-s-amber-300' },
  air: { icon: Plane, tone: 'bg-sky-50 text-sky-800', stripe: 'border-s-sky-400' },
  shein: { icon: ShoppingBag, tone: 'bg-red-50 text-red-700', stripe: 'border-s-gold-500' },
  chinese_sites: { icon: Globe, tone: 'bg-red-50 text-red-700', stripe: 'border-s-gold-500' },
};

/** The coloured start-side stripe of a list row (add to the row's classes). */
export const categoryStripe = (category: ServiceCategory) =>
  cn('border-s-4', CATEGORY_LOOK[category].stripe);
