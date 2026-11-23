import type { FieldValues } from 'react-hook-form';
import type { z } from 'zod';
import {
  ORDER_FORM_VERSIONS,
  orderObjects,
  orderRules,
  orderSchemas,
  type ServiceType,
} from '@mirhalgo/shared';

/*
 * New Request forms (MW_003 B3–B5). The form keeps "raw" values whose structure mirrors the
 * order (so a schema issue path is also the form field name); pruneOrder() keeps only what
 * the chosen path shows, and the shared orderSchemas[service] validates it.
 */

export const REQUEST_STEPS = {
  international: ['customer', 'operation', 'route', 'cargo', 'services', 'review'],
  domestic: ['customer', 'operation', 'route', 'cargo', 'services', 'review'],
  china: ['customer', 'order', 'delivery', 'review'],
} as const;
export type RequestStep = (typeof REQUEST_STEPS)[ServiceType][number];

/** The step that owns a schema issue (so "Next" shows only its own errors). */
export function stepOfIssue(service: ServiceType, path: readonly (string | number)[]): RequestStep {
  const [first, second] = path;
  if (first === 'contact') return 'customer';
  if (service === 'china') {
    if (first === 'order') return 'order';
    if (first === 'delivery') return 'delivery';
    return 'review';
  }
  if (first === 'operation') return 'operation';
  if (first === 'shipment') {
    if (second === 'mode') return 'operation';
    return second === 'cargo' ? 'cargo' : 'route';
  }
  if (first === 'readyDate' || first === 'cargoValue' || first === 'shipmentDocuments')
    return 'cargo';
  if (first === 'services' || first === 'notes') return 'services';
  return 'review';
}

type Issue = { path: (string | number)[]; message: string };

/**
 * Schema issues of a (pruned) order, all of them or only those of one step.
 *
 * Zod skips the cross-field rules while any field is missing, and the later steps are still
 * empty when "Next" is pressed. So when the step has no field errors of its own, its rules are
 * run directly: every top-level part that parses is given as parsed values (numbers, defaults),
 * the others as typed. Rules of later parts may throw on missing data: those are not this
 * step's errors.
 */
export function orderIssues(
  service: ServiceType,
  order: Record<string, unknown>,
  step?: RequestStep,
): Issue[] {
  const result = orderSchemas[service].safeParse(order);
  if (result.success) return [];
  const own = (issue: Issue) => !step || stepOfIssue(service, issue.path) === step;
  const fieldIssues = result.error.issues.filter(own);
  if (!step || fieldIssues.length) return fieldIssues;

  const shape = orderObjects[service].shape as Record<string, z.ZodTypeAny>;
  const parsed = Object.fromEntries(
    Object.entries(order).map(([key, value]) => {
      const part = shape[key]?.safeParse(value);
      return [key, part?.success ? part.data : value];
    }),
  );
  const ruleIssues: Issue[] = [];
  const ctx = {
    path: [],
    addIssue: ({ path = [], message = 'validation.required' }) =>
      ruleIssues.push({ path, message }),
  } as unknown as z.RefinementCtx;
  try {
    (orderRules[service] as (value: unknown, ctx: z.RefinementCtx) => void)(parsed, ctx);
  } catch {
    // a later step is not filled yet
  }
  return ruleIssues.filter(own);
}

/** Changing one of these switches part of the form on or off: hidden values are cleared. */
export const BRANCH_FIELDS = new Set([
  'mode',
  'seaType',
  'landType',
  'loadType',
  'airService',
  'serviceScope',
  'clientType',
  'whatsappSameAsPhone',
  'inputMethod',
  'hazardous',
  'packaging',
  'source',
  'chineseSite',
  'addMethod',
  'truckingNeeded',
  'side',
  'hasColors',
  'hasSizes',
  'isOther',
  'any',
]);

/** Form-only keys that are not part of the order (kept when hidden values are cleared). */
export const UI_ONLY_KEYS = new Set(['isOther', 'hasColors', 'hasSizes', 'truckingNeeded']);

export type Prefill = { fullName: string; phone: string };

/** The empty form of a service, with the contact prefilled from the profile (spec B2). */
export function emptyValues(service: ServiceType, prefill: Prefill): FieldValues {
  const contact = {
    fullName: prefill.fullName,
    phone: prefill.phone,
    whatsappSameAsPhone: true,
    whatsapp: '',
    businessName: '',
  };
  if (service === 'china') {
    return {
      contact,
      order: { products: [{ quantity: '1', colors: [], sizes: [] }] },
      delivery: { receiverName: prefill.fullName, receiverPhone: prefill.phone },
      notes: '',
    };
  }
  return {
    contact,
    operation: {},
    shipment: {
      cargo: {
        groups: [{ count: '1' }],
        items: [{ cartons: '1', weight: { unit: 'kg' } }],
      },
    },
    services: { availableDocuments: [], insurance: false, warehousing: false },
    shipmentDocuments: { commercialInvoice: [], packingList: [], draftBl: [], other: [] },
    readyDate: '',
    notes: '',
  };
}

export const formVersionOf = (service: ServiceType) => ORDER_FORM_VERSIONS[service];

/** Every upload id the form refers to (for the draft), whatever field holds it. */
export function uploadIdsIn(values: unknown): string[] {
  const ids = new Set<string>();
  const walk = (node: unknown, key = '') => {
    if (Array.isArray(node)) {
      const isIdList =
        /UploadIds$/.test(key) ||
        ['commercialInvoice', 'packingList', 'draftBl', 'other'].includes(key);
      node.forEach((item) => (isIdList && typeof item === 'string' ? ids.add(item) : walk(item)));
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (/UploadId$/.test(k) && typeof v === 'string' && v) ids.add(v);
        else walk(v, k);
      }
    }
  };
  walk(values);
  return [...ids];
}

/** Schema messages are i18n keys; anything else (Zod defaults) reads as "required". */
export const issueMessage = (message: string) =>
  message.startsWith('validation.') ? message : 'validation.required';
