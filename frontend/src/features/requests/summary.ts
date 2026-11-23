import type { TFunction } from 'i18next';
import type { ServiceType, UploadedFile } from '@mirhalgo/shared';
import { stepOfIssue, type RequestStep } from './model';

/*
 * Review summary (spec B3 Step 6): a walk over the PRUNED order, so the review always shows
 * exactly what will be submitted. Values are formatted for people: option labels, reference
 * names, weights, money, dimensions, file names.
 */

export type SummaryRow = { label: string; value: string };
type Json = Record<string, unknown>;

/** Keys whose value is an option of a fixed list (portal.request.options.<list>). */
const OPTION_LISTS: Record<string, string> = {
  clientType: 'clientType',
  operationType: 'operationType',
  serviceScope: 'serviceScope',
  mode: 'mode',
  shippingMethod: 'mode',
  seaType: 'seaType',
  landType: 'landType',
  loadType: 'loadType',
  airService: 'airService',
  clearanceLocation: 'routeSide',
  side: 'routeSide',
  inputMethod: 'inputMethod',
  packaging: 'packaging',
  executionDocuments: 'executionDocuments',
  availableDocuments: 'availableDocuments',
  source: 'source',
  sheinSite: 'sheinSite',
  chineseSite: 'chineseSite',
  addMethod: 'addMethod',
};

/** Keys whose value is a reference id: the list that names it. */
const NAMED: Record<string, string> = {
  country: 'countries',
  port: 'ports',
  airport: 'airports',
  city: 'cities',
  loadingRegion: 'regions',
  unloadingRegion: 'regions',
  dischargePort: 'ports',
  containerType: 'container-types',
  truckType: 'truck-types',
  shippingLine: 'shipping-lines',
};

/** Wrappers that do not add anything to a label. */
const WRAPPERS = new Set([
  'contact',
  'operation',
  'shipment',
  'cargo',
  'services',
  'order',
  'delivery',
  'shipmentDocuments',
]);
const SKIP = new Set(['service', 'formVersion', 'kind', 'confirmAccuracy', 'whatsappSameAsPhone']);
const UPLOAD_KEY = /UploadIds?$|^(commercialInvoice|packingList|draftBl|other)$/;

export type SummaryContext = {
  t: TFunction;
  language: string;
  /** Name of a reference item: names(list, id). */
  names: (list: string, id: string) => string | undefined;
  uploads: Record<string, UploadedFile>;
};

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function formatValue(key: string, value: unknown, ctx: SummaryContext): string | null {
  const { t, language } = ctx;
  const num = (n: unknown) => Number(n).toLocaleString(language);
  const list = (items: string[]) => new Intl.ListFormat(language, { type: 'unit' }).format(items);
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return t(value ? 'portal.request.yes' : 'portal.request.no');
  if (UPLOAD_KEY.test(key)) {
    const ids = Array.isArray(value) ? (value as string[]) : [value as string];
    return list(ids.map((id) => ctx.uploads[id]?.name ?? t('portal.request.attachedFile'))) || null;
  }
  if (Array.isArray(value)) {
    const options = OPTION_LISTS[key];
    return options ? list(value.map((v) => t(`portal.request.options.${options}.${v}`))) : null;
  }
  if (isObject(value)) {
    if (WRAPPERS.has(key)) return null;
    if ('any' in value) return t('portal.request.anyAirport');
    if (typeof value.other === 'string')
      return `${String(value.other)} (${t('portal.request.otherOption')})`;
    if ('id' in value) return ctx.names(NAMED[key] ?? '', String(value.id)) ?? String(value.id);
    if ('unit' in value)
      return `${num(value.value)} ${t(`portal.request.options.weightUnit.${value.unit}`)}`;
    if ('currency' in value) return `${num(value.amount)} ${String(value.currency)}`;
    if ('length' in value)
      return `${num(value.length)} × ${num(value.width)} × ${num(value.height)} ${t('portal.request.cm')}`;
    return null;
  }
  if (typeof value === 'string' && OPTION_LISTS[key])
    return t(`portal.request.options.${OPTION_LISTS[key]}.${value}`);
  if (typeof value === 'string' && NAMED[key]) return ctx.names(NAMED[key]!, value) ?? value;
  return String(value);
}

/** Rows of the order, grouped by the step that owns them. */
export function summarize(
  service: ServiceType,
  order: Json,
  ctx: SummaryContext,
): Map<RequestStep, SummaryRow[]> {
  const out = new Map<RequestStep, SummaryRow[]>();
  const add = (path: (string | number)[], row: SummaryRow) => {
    const step = stepOfIssue(service, path);
    out.set(step, [...(out.get(step) ?? []), row]);
  };
  const walk = (node: unknown, path: (string | number)[], labels: string[]) => {
    const key = String(path.at(-1) ?? '');
    const formatted = formatValue(key, node, ctx);
    if (formatted !== null || !(isObject(node) || Array.isArray(node))) {
      if (formatted !== null) add(path, { label: labels.join(' · '), value: formatted });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) =>
        walk(
          item,
          [...path, i],
          [
            ...labels.slice(0, -1),
            `${labels.at(-1) ?? ''} ${(i + 1).toLocaleString(ctx.language)}`,
          ],
        ),
      );
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (SKIP.has(k)) continue;
      const label = WRAPPERS.has(k) ? labels : [...labels, ctx.t(`portal.request.fields.${k}`)];
      walk(v, [...path, k], label);
    }
  };
  walk(order, [], []);
  return out;
}
