import { z } from 'zod';
import {
  ADD_METHODS,
  AIR_SERVICES,
  AVAILABLE_DOCUMENTS,
  CHINA_SHIPPING_METHODS,
  CHINA_SOURCES,
  CHINESE_SITES,
  CLIENT_TYPES,
  CURRENCIES,
  EXECUTION_DOCUMENTS,
  INCOTERMS,
  INPUT_METHODS,
  LOAD_TYPES,
  NAMED_CLIENT_TYPES,
  ORDER_FORM_VERSIONS,
  ORDER_LIMITS as L,
  PACKAGING_TYPES,
  ROUTE_SIDES,
  SERVICE_SCOPES,
  SHEIN_SITES,
  SHIPPING_CLIENT_TYPES,
  SHIPPING_MODES,
  WEIGHT_UNITS,
  type AttachmentSlot,
} from '../orders.js';
import { ORDER_FILE_LIMITS } from '../orderFiles.js';
import { optional, phoneSchema, textSchema, toAsciiDigits } from './fields.js';

/*
 * POST /api/orders (MW_003 B3–B5): one schema, discriminated by service → mode → type. The web
 * form and the API use it. Every object is strict: a field of another path is rejected (the
 * form removes hidden values before submit). Cross-field rules are in one superRefine per
 * service. Derived values (CBM, volumetric weight, totals) are computed by deriveOrderValues(),
 * never taken from the client.
 */

const required = () => ({ errorMap: () => ({ message: 'validation.required' }) });
const issue = (ctx: z.RefinementCtx, path: (string | number)[], message: string) =>
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
/** A value of a hidden part of the form (the client should have removed it). */
const forbid = (ctx: z.RefinementCtx, value: unknown, path: (string | number)[]) => {
  if (value !== undefined) issue(ctx, path, 'validation.notAllowed');
};
const need = (ctx: z.RefinementCtx, value: unknown, path: (string | number)[]) => {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    issue(ctx, path, 'validation.required');
  }
};

// ── field helpers ─────────────────────────────────────────────────────────────

/** A number typed in a form (Arabic / Persian digits, "٫" decimal separator) or sent as JSON. */
export const numberInput = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const text = toAsciiDigits(value.trim()).replace(/\u066B/g, '.');
  return text === '' ? undefined : Number(text);
};

const decimal = (min: number, max: number, decimals: number) =>
  z.preprocess(
    numberInput,
    z
      .number({
        required_error: 'validation.required',
        invalid_type_error: 'validation.positiveNumber',
      })
      .finite('validation.positiveNumber')
      .min(min, 'validation.positiveNumber')
      .max(max, 'validation.positiveNumber')
      .transform((n) => Number(n.toFixed(decimals))),
  );

const wholeNumber = (min: number, max: number) =>
  z.preprocess(
    numberInput,
    z
      .number({
        required_error: 'validation.required',
        invalid_type_error: 'validation.wholeNumber',
      })
      .int('validation.wholeNumber')
      .min(min, 'validation.wholeNumber')
      .max(max, 'validation.wholeNumber'),
  );

const text = (range: { min: number; max: number }, error: string) => textSchema(range, error);
const description = text(L.description, 'validation.descriptionLength');
const address = text(L.address, 'validation.addressLength');
const notes = optional(
  textSchema({ min: 1, max: L.notesMax }, 'validation.notesLength', { multiline: true }),
);
const uploadId = z.string().uuid('validation.required');
const uploadIds = (max: number) =>
  z
    .array(uploadId)
    .max(max, 'validation.maxItems')
    .refine((ids) => new Set(ids).size === ids.length, 'validation.duplicate');

/** A reference-list id (ports, cities, container types…); the API checks it exists. */
const refId = z.string(required()).regex(/^[A-Za-z0-9_.-]{1,60}$/, 'validation.required');
const countryCode = z.string(required()).regex(/^[A-Z]{2}$/, 'validation.required');
/** A list item, or "Other" with the value typed by the user (stored separately, spec B2). */
const placeRef = z.union([
  z.object({ id: refId }).strict(),
  z.object({ other: text({ min: 3, max: 100 }, 'validation.otherOptionLength') }).strict(),
]);
export type PlaceRef = z.infer<typeof placeRef>;

const weight = z
  .object({ value: decimal(0.001, L.weight, 3), unit: z.enum(WEIGHT_UNITS, required()) })
  .strict();
const money = z
  .object({ amount: decimal(0, L.money, 2), currency: z.enum(CURRENCIES, required()) })
  .strict();
const dimensions = z
  .object({
    length: decimal(0.1, L.dimensionCm, 1),
    width: decimal(0.1, L.dimensionCm, 1),
    height: decimal(0.1, L.dimensionCm, 1),
  })
  .strict();

/** "YYYY-MM-DD" today in Cairo (the ready date is checked against it on both sides). */
export const cairoToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now);
/** "YYYY-MM-DD", today (Cairo) or later. Also the company offer dates (MW_004 B1). */
export const notPastDate = z
  .string(required())
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.required')
  .refine((date) => date >= cairoToday(), 'validation.readyDate');
const readyDate = notPastDate;

// ── Step 1: contact (prefilled, editable) ────────────────────────────────────

const contactShape = (clientTypes: readonly [string, ...string[]]) =>
  z
    .object({
      fullName: text({ min: 3, max: 80 }, 'validation.fullNameLength'),
      phone: phoneSchema,
      whatsappSameAsPhone: z.boolean(),
      whatsapp: phoneSchema.optional(),
      clientType: z.enum(clientTypes as [string, ...string[]], required()),
      businessName: text({ min: 2, max: 120 }, 'validation.companyNameLength').optional(),
    })
    .strict();

function refineContact(
  contact: {
    whatsappSameAsPhone: boolean;
    whatsapp?: string;
    clientType: string;
    businessName?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (contact.whatsappSameAsPhone) forbid(ctx, contact.whatsapp, ['contact', 'whatsapp']);
  else need(ctx, contact.whatsapp, ['contact', 'whatsapp']);
  if (NAMED_CLIENT_TYPES.includes(contact.clientType as never)) {
    need(ctx, contact.businessName, ['contact', 'businessName']);
  } else {
    forbid(ctx, contact.businessName, ['contact', 'businessName']);
  }
}

// ── cargo (Step 4) ────────────────────────────────────────────────────────────

const hazardFields = { hazardous: z.boolean(required()), msdsUploadId: uploadId.optional() };

const containerGroup = z
  .object({
    containerType: refId,
    count: wholeNumber(1, L.count),
    description,
    weightPerContainer: weight.optional(),
    shippingLine: placeRef.optional(),
    targetPrice: money.optional(), // FCL only
  })
  .strict();

const containersCargo = z
  .object({
    kind: z.literal('containers'),
    groups: z
      .array(containerGroup)
      .min(1, 'validation.required')
      .max(L.groups, 'validation.maxItems'),
    ...hazardFields,
  })
  .strict();

const trucksCargo = z
  .object({
    kind: z.literal('trucks'),
    groups: z
      .array(
        z
          .object({
            truckType: refId,
            count: wholeNumber(1, L.count),
            description,
            weight: weight.optional(),
          })
          .strict(),
      )
      .min(1, 'validation.required')
      .max(L.groups, 'validation.maxItems'),
    packaging: z.enum(PACKAGING_TYPES, required()),
    packagingOther: text({ min: 3, max: 100 }, 'validation.otherOptionLength').optional(),
    ...hazardFields,
  })
  .strict();

const ltlCargo = z
  .object({
    kind: z.literal('ltl'),
    description,
    inputMethod: z.enum(INPUT_METHODS, required()),
    totalWeight: weight.optional(),
    pieces: wholeNumber(1, L.cartons).optional(),
    volumeCbm: decimal(0.001, 10_000, 3).optional(),
    dimensions: dimensions.optional(),
    packingListUploadId: uploadId.optional(),
    ...hazardFields,
  })
  .strict();

const looseItem = z
  .object({
    description: text({ min: 2, max: 200 }, 'validation.descriptionLength'),
    weight,
    cartons: wholeNumber(1, L.cartons),
    dimensions,
    hazardous: z.boolean(required()),
    msdsUploadId: uploadId.optional(),
  })
  .strict();

/** LCL and air: manual products (hazardous per product) or a packing list. */
const looseCargo = z
  .object({
    kind: z.literal('loose'),
    description,
    inputMethod: z.enum(INPUT_METHODS, required()),
    items: z.array(looseItem).max(L.items, 'validation.maxItems').optional(),
    packingListUploadId: uploadId.optional(),
    hazardous: z.boolean().optional(),
    msdsUploadId: uploadId.optional(),
  })
  .strict();

type Cargo =
  | z.infer<typeof containersCargo>
  | z.infer<typeof trucksCargo>
  | z.infer<typeof ltlCargo>
  | z.infer<typeof looseCargo>;

function refineCargo(cargo: Cargo, ctx: z.RefinementCtx, { prices }: { prices: boolean }) {
  const at = (...path: (string | number)[]) => ['shipment', 'cargo', ...path];
  const hazard = (
    h: { hazardous?: boolean; msdsUploadId?: string },
    ...path: (string | number)[]
  ) => {
    if (h.hazardous) need(ctx, h.msdsUploadId, at(...path, 'msdsUploadId'));
    else forbid(ctx, h.msdsUploadId, at(...path, 'msdsUploadId'));
  };
  switch (cargo.kind) {
    case 'containers':
      if (!prices)
        cargo.groups.forEach((g, i) => forbid(ctx, g.targetPrice, at('groups', i, 'targetPrice')));
      hazard(cargo);
      break;
    case 'trucks':
      if (cargo.packaging === 'other') need(ctx, cargo.packagingOther, at('packagingOther'));
      else forbid(ctx, cargo.packagingOther, at('packagingOther'));
      hazard(cargo);
      break;
    case 'ltl':
      if (cargo.inputMethod === 'manual') {
        need(ctx, cargo.totalWeight, at('totalWeight'));
        need(ctx, cargo.pieces, at('pieces'));
        forbid(ctx, cargo.packingListUploadId, at('packingListUploadId'));
      } else {
        need(ctx, cargo.packingListUploadId, at('packingListUploadId'));
        for (const key of ['totalWeight', 'pieces', 'volumeCbm', 'dimensions'] as const) {
          forbid(ctx, cargo[key], at(key));
        }
      }
      hazard(cargo);
      break;
    case 'loose':
      if (cargo.inputMethod === 'manual') {
        // demo bug: the manual method passed with zero products
        need(ctx, cargo.items, at('items'));
        forbid(ctx, cargo.packingListUploadId, at('packingListUploadId'));
        forbid(ctx, cargo.hazardous, at('hazardous'));
        forbid(ctx, cargo.msdsUploadId, at('msdsUploadId'));
        cargo.items?.forEach((item, i) => hazard(item, 'items', i));
      } else {
        need(ctx, cargo.packingListUploadId, at('packingListUploadId'));
        forbid(ctx, cargo.items, at('items'));
        if (cargo.hazardous === undefined) issue(ctx, at('hazardous'), 'validation.required');
        hazard(cargo);
      }
      break;
  }
}

/** The cargo kind each route allows (spec B3 Step 4). */
function expectCargo(ctx: z.RefinementCtx, cargo: Cargo, kind: Cargo['kind']) {
  if (cargo.kind !== kind) issue(ctx, ['shipment', 'cargo', 'kind'], 'validation.required');
}

// ── shared by international + domestic: Step 4 extras, Step 5 ───────────────

const shipmentDocuments = z
  .object({
    commercialInvoice: uploadIds(5).default([]),
    packingList: uploadIds(5).default([]),
    draftBl: uploadIds(5).default([]),
    other: uploadIds(5).default([]),
  })
  .strict();

const commonShipping = {
  readyDate,
  cargoValue: money.optional(),
  shipmentDocuments: shipmentDocuments.optional(),
  notes,
  confirmAccuracy: z.literal(true, { errorMap: () => ({ message: 'validation.declaration' }) }),
};

const multiSelect = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values, required()))
    .max(values.length)
    .refine((list) => new Set(list).size === list.length, 'validation.duplicate');

// ── International (spec B3) ───────────────────────────────────────────────────

const seaPlace = z.object({ country: countryCode, port: placeRef }).strict();
const airOrigin = z
  .object({
    country: countryCode,
    airport: z.union([placeRef, z.object({ any: z.literal(true) }).strict()]),
  })
  .strict();
const airDestination = z.object({ country: countryCode, airport: placeRef }).strict();
const landPlace = z.object({ country: countryCode, city: placeRef }).strict();
const routeSide = z.enum(ROUTE_SIDES, required());

const internationalObject = z
  .object({
    service: z.literal('international'),
    formVersion: z.literal(ORDER_FORM_VERSIONS.international),
    contact: contactShape(SHIPPING_CLIENT_TYPES),
    operation: z
      .object({
        // demo bug: "Domestic" belongs to the domestic service only
        operationType: z.enum(['export', 'import'], required()),
        serviceScope: z.enum(SERVICE_SCOPES, required()),
      })
      .strict(),
    shipment: z.discriminatedUnion('mode', [
      z
        .object({
          mode: z.literal('sea'),
          seaType: z.enum(['fcl', 'lcl'], required()),
          origin: seaPlace,
          destination: seaPlace,
          clearanceLocation: routeSide.optional(),
          trucking: z
            .object({
              side: routeSide,
              originAddress: address.optional(),
              destinationAddress: address.optional(),
            })
            .strict()
            .optional(),
          cargo: z.discriminatedUnion('kind', [containersCargo, looseCargo]),
        })
        .strict(),
      z
        .object({
          mode: z.literal('air'),
          origin: airOrigin,
          destination: airDestination,
          airService: z.enum(AIR_SERVICES, required()),
          pickupAddress: address.optional(),
          deliveryAddress: address.optional(),
          clearanceLocation: routeSide.optional(),
          cargo: looseCargo,
        })
        .strict(),
      z
        .object({
          mode: z.literal('land'),
          landType: z.enum(['container', 'general'], required()),
          loadType: z.enum(LOAD_TYPES, required()).optional(),
          origin: landPlace,
          destination: landPlace,
          clearancePoint: text({ min: 3, max: 100 }, 'validation.otherOptionLength').optional(),
          cargo: z.discriminatedUnion('kind', [containersCargo, trucksCargo, ltlCargo]),
        })
        .strict(),
    ]),
    services: z
      .object({
        availableDocuments: multiSelect(AVAILABLE_DOCUMENTS).default([]),
        executionDocuments: z.enum(EXECUTION_DOCUMENTS, required()),
        insurance: z.boolean().default(false),
        warehousing: z.boolean().default(false),
        incoterm: z.enum(INCOTERMS).optional(),
      })
      .strict(),
    ...commonShipping,
  })
  .strict();

function refineInternational(order: z.output<typeof internationalObject>, ctx: z.RefinementCtx) {
  refineContact(order.contact, ctx);
  const s = order.shipment;
  const at = (...path: (string | number)[]) => ['shipment', ...path];
  const withCustoms = order.operation.serviceScope !== 'shipping';
  const clearance = (value: unknown, key: string) =>
    withCustoms ? need(ctx, value, at(key)) : forbid(ctx, value, at(key));

  if (s.mode === 'sea') {
    clearance(s.clearanceLocation, 'clearanceLocation'); // demo bug: not validated for sea
    expectCargo(ctx, s.cargo, s.seaType === 'fcl' ? 'containers' : 'loose');
    if (s.trucking) {
      const both = s.trucking.side === 'both';
      const origin = both || s.trucking.side === 'origin';
      const destination = both || s.trucking.side === 'destination';
      (origin ? need : forbid)(ctx, s.trucking.originAddress, at('trucking', 'originAddress'));
      (destination ? need : forbid)(
        ctx,
        s.trucking.destinationAddress,
        at('trucking', 'destinationAddress'),
      );
    }
  } else if (s.mode === 'air') {
    clearance(s.clearanceLocation, 'clearanceLocation');
    const fromDoor = s.airService.startsWith('door');
    const toDoor = s.airService.endsWith('door');
    (fromDoor ? need : forbid)(ctx, s.pickupAddress, at('pickupAddress'));
    (toDoor ? need : forbid)(ctx, s.deliveryAddress, at('deliveryAddress'));
  } else {
    clearance(s.clearancePoint, 'clearancePoint');
    if (s.landType === 'general') need(ctx, s.loadType, at('loadType'));
    else forbid(ctx, s.loadType, at('loadType'));
    expectCargo(
      ctx,
      s.cargo,
      s.landType === 'container' ? 'containers' : s.loadType === 'ltl' ? 'ltl' : 'trucks',
    );
  }
  refineCargo(s.cargo, ctx, { prices: s.mode === 'sea' });
  if (order.services.insurance) need(ctx, order.cargoValue, ['cargoValue']);
}

// ── Domestic (spec B4): operation fixed to domestic / land / shipping only ───

const domesticObject = z
  .object({
    service: z.literal('domestic'),
    formVersion: z.literal(ORDER_FORM_VERSIONS.domestic),
    contact: contactShape(SHIPPING_CLIENT_TYPES),
    shipment: z.discriminatedUnion('landType', [
      z
        .object({
          landType: z.literal('container'),
          loadingRegion: refId,
          loadingAddress: address.optional(),
          dischargePort: refId,
          cargo: containersCargo,
        })
        .strict(),
      z
        .object({
          landType: z.literal('general'),
          loadType: z.enum(LOAD_TYPES, required()),
          loadingRegion: refId,
          loadingAddress: address.optional(),
          unloadingRegion: refId,
          unloadingAddress: address.optional(),
          cargo: z.discriminatedUnion('kind', [trucksCargo, ltlCargo]),
        })
        .strict(),
    ]),
    services: z
      .object({
        availableDocuments: multiSelect(AVAILABLE_DOCUMENTS).default([]),
        executionDocuments: z.enum(EXECUTION_DOCUMENTS).optional(),
        insurance: z.boolean().default(false),
        warehousing: z.boolean().default(false),
      })
      .strict(),
    ...commonShipping,
  })
  .strict();

function refineDomestic(order: z.output<typeof domesticObject>, ctx: z.RefinementCtx) {
  refineContact(order.contact, ctx);
  const s = order.shipment;
  // demo bug: the domestic route was never validated; regions are Egyptian governorates
  const egyptian = (id: string, key: string) => {
    if (!id.startsWith('EG-')) issue(ctx, ['shipment', key], 'validation.required');
  };
  egyptian(s.loadingRegion, 'loadingRegion');
  if (s.landType === 'general') {
    egyptian(s.unloadingRegion, 'unloadingRegion');
    expectCargo(ctx, s.cargo, s.loadType === 'ltl' ? 'ltl' : 'trucks');
  }
  refineCargo(s.cargo, ctx, { prices: false });
  if (order.services.insurance) need(ctx, order.cargoValue, ['cargoValue']);
}

// ── SHEIN & Chinese sites (spec B5) ───────────────────────────────────────────

const httpUrl = z
  .string(required())
  .trim()
  .max(L.urlMax, 'validation.url')
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'validation.url');
const httpsUrl = httpUrl.refine((value) => value.startsWith('https://'), 'validation.httpsUrl');

const variant = z
  .object({
    value: text({ min: 1, max: 40 }, 'validation.otherOptionLength'),
    quantity: wholeNumber(1, 10_000),
  })
  .strict();
const chinaProduct = z
  .object({
    url: httpUrl.optional(),
    name: text({ min: 2, max: 200 }, 'validation.descriptionLength').optional(),
    quantity: wholeNumber(1, 10_000),
    colors: z.array(variant).max(L.variants, 'validation.maxItems').optional(),
    sizes: z.array(variant).max(L.variants, 'validation.maxItems').optional(),
    notes: optional(
      textSchema({ min: 1, max: 500 }, 'validation.notesLength', { multiline: true }),
    ),
  })
  .strict();

const chinaObject = z
  .object({
    service: z.literal('china'),
    formVersion: z.literal(ORDER_FORM_VERSIONS.china),
    contact: contactShape(CLIENT_TYPES),
    order: z
      .object({
        source: z.enum(CHINA_SOURCES, required()),
        sheinSite: z.enum(SHEIN_SITES, required()).optional(),
        chineseSite: z.enum(CHINESE_SITES, required()).optional(),
        chineseSiteOther: text({ min: 2, max: 300 }, 'validation.otherOptionLength').optional(),
        addMethod: z.enum(ADD_METHODS, required()),
        cartLink: httpsUrl.optional(),
        screenshotUploadIds: uploadIds(ORDER_FILE_LIMITS.screenshotsPerOrder).optional(),
        products: z.array(chinaProduct).max(L.chinaProducts.max, 'validation.maxItems').optional(),
      })
      .strict(),
    delivery: z
      .object({
        shippingMethod: z.enum(SHIPPING_MODES, required()),
        supplierAddress: optional(address),
        country: z.union([
          z.object({ id: countryCode }).strict(),
          z.object({ other: text({ min: 3, max: 100 }, 'validation.otherOptionLength') }).strict(),
        ]),
        city: placeRef,
        address,
        receiverName: text({ min: 3, max: 80 }, 'validation.fullNameLength'),
        receiverPhone: phoneSchema,
      })
      .strict(),
    notes,
    confirmAccuracy: z.literal(true, { errorMap: () => ({ message: 'validation.declaration' }) }),
  })
  .strict();

function refineChina(order: z.output<typeof chinaObject>, ctx: z.RefinementCtx) {
  refineContact(order.contact, ctx);
  const o = order.order;
  const at = (...path: (string | number)[]) => ['order', ...path];
  if (o.source === 'shein') {
    need(ctx, o.sheinSite, at('sheinSite'));
    forbid(ctx, o.chineseSite, at('chineseSite'));
    forbid(ctx, o.chineseSiteOther, at('chineseSiteOther'));
    forbid(ctx, order.delivery.supplierAddress, ['delivery', 'supplierAddress']);
  } else {
    forbid(ctx, o.sheinSite, at('sheinSite'));
    need(ctx, o.chineseSite, at('chineseSite'));
    (o.chineseSite === 'other' ? need : forbid)(ctx, o.chineseSiteOther, at('chineseSiteOther'));
  }
  const method = {
    cart_link: 'cartLink',
    screenshots: 'screenshotUploadIds',
    manual: 'products',
  } as const;
  for (const [addMethod, key] of Object.entries(method)) {
    (o.addMethod === addMethod ? need : forbid)(ctx, o[key], at(key));
  }
  o.products?.forEach((product, i) => {
    if (!product.url && !product.name)
      issue(ctx, at('products', i, 'name'), 'validation.productNameOrUrl');
    for (const key of ['colors', 'sizes'] as const) {
      const list = product[key];
      if (list?.length && list.reduce((sum, v) => sum + v.quantity, 0) !== product.quantity) {
        issue(ctx, at('products', i, key), 'validation.quantitiesMustMatch');
      }
    }
  });
  if (!CHINA_SHIPPING_METHODS[o.source].includes(order.delivery.shippingMethod)) {
    issue(ctx, ['delivery', 'shippingMethod'], 'validation.required');
  }
  // "Other" country: the city is typed too
  if ('other' in order.delivery.country && !('other' in order.delivery.city)) {
    issue(ctx, ['delivery', 'city'], 'validation.required');
  }
}

/** The whole order (POST /api/orders body): the plain objects + one set of rules per service. */
export const orderSchema = z
  .discriminatedUnion('service', [internationalObject, domesticObject, chinaObject])
  .superRefine((order, ctx) => {
    if (order.service === 'international') refineInternational(order, ctx);
    else if (order.service === 'domestic') refineDomestic(order, ctx);
    else refineChina(order, ctx);
  });

/** Per-service schemas (the forms validate them step by step). */
export const orderSchemas = {
  international: internationalObject.superRefine(refineInternational),
  domestic: domesticObject.superRefine(refineDomestic),
  china: chinaObject.superRefine(refineChina),
};

/**
 * The same objects and rules, apart. Zod runs a superRefine only when the object itself parsed,
 * so a form step whose later steps are still empty cannot see its cross-field errors through
 * orderSchemas; it runs the rules itself (web `stepIssues`). The server uses orderSchema.
 */
export const orderObjects = {
  international: internationalObject,
  domestic: domesticObject,
  china: chinaObject,
};
export const orderRules = {
  international: refineInternational,
  domestic: refineDomestic,
  china: refineChina,
};

export type OrderInput = z.input<typeof orderSchema>;
export type Order = z.output<typeof orderSchema>;
export type InternationalOrder = z.output<typeof internationalObject>;
export type DomesticOrder = z.output<typeof domesticObject>;
export type ChinaOrder = z.output<typeof chinaObject>;

// ── attachments + derived values (server side) ───────────────────────────────

export type OrderAttachmentRef = { uploadId: string; slot: AttachmentSlot; itemPosition?: number };

/** Every uploaded file the order refers to, with where it belongs. */
export function collectAttachments(order: Order): OrderAttachmentRef[] {
  const refs: OrderAttachmentRef[] = [];
  const add = (uploadId: string | undefined, slot: AttachmentSlot, itemPosition?: number) => {
    if (uploadId)
      refs.push({ uploadId, slot, ...(itemPosition === undefined ? {} : { itemPosition }) });
  };
  if (order.service === 'china') {
    for (const id of order.order.screenshotUploadIds ?? []) add(id, 'screenshot');
    return refs;
  }
  const cargo = order.shipment.cargo;
  add(cargo.msdsUploadId, 'msds');
  if (cargo.kind === 'ltl' || cargo.kind === 'loose')
    add(cargo.packingListUploadId, 'cargo_packing_list');
  if (cargo.kind === 'loose')
    cargo.items?.forEach((item, i) => add(item.msdsUploadId, 'item_msds', i));
  const docs = order.shipmentDocuments;
  for (const id of docs?.commercialInvoice ?? []) add(id, 'commercial_invoice');
  for (const id of docs?.packingList ?? []) add(id, 'packing_list');
  for (const id of docs?.draftBl ?? []) add(id, 'draft_bl');
  for (const id of docs?.other ?? []) add(id, 'other_document');
  return refs;
}

const round = (n: number, decimals: number) => Number(n.toFixed(decimals));

/**
 * Values never taken from the client (spec B9): CBM per product (L×W×H / 1,000,000 × cartons),
 * air volumetric weight (L×W×H / 6000 × cartons, information only) and the totals.
 */
export function deriveOrderValues(order: Order) {
  if (order.service === 'china') {
    return { items: [], totalContainers: null, totalTrucks: null, totalCbm: null };
  }
  const cargo = order.shipment.cargo;
  const air = order.service === 'international' && order.shipment.mode === 'air';
  const items =
    cargo.kind === 'loose'
      ? (cargo.items ?? []).map(({ dimensions: d, cartons }) => {
          const cm3 = d.length * d.width * d.height * cartons;
          return {
            cbm: round(cm3 / 1_000_000, 3),
            volumetricKg: air ? round(cm3 / 6000, 2) : null,
          };
        })
      : [];
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return {
    items,
    totalContainers: cargo.kind === 'containers' ? sum(cargo.groups.map((g) => g.count)) : null,
    totalTrucks: cargo.kind === 'trucks' ? sum(cargo.groups.map((g) => g.count)) : null,
    totalCbm: items.length ? round(sum(items.map((i) => i.cbm)), 3) : null,
  };
}
export type DerivedOrderValues = ReturnType<typeof deriveOrderValues>;
