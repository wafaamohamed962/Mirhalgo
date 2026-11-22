import { describe, expect, it } from 'vitest';
import { cairoToday, collectAttachments, deriveOrderValues, orderSchema } from '../src/index.js';

/* POST /api/orders schema (MW_003 B3–B5): every path, the cross-field rules, the demo bugs. */

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tomorrow = () => {
  const d = new Date(`${cairoToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const contact = {
  fullName: 'Wafaa Mohamed',
  phone: '+201012345678',
  whatsappSameAsPhone: true,
  clientType: 'company',
  businessName: 'Nile Imports',
};
const common = {
  readyDate: tomorrow(),
  confirmAccuracy: true,
};
const containers = {
  kind: 'containers',
  groups: [
    {
      containerType: '40_high_cube',
      count: '٢',
      description: 'Ceramic tiles',
      targetPrice: { amount: '1500', currency: 'USD' },
    },
  ],
  hazardous: false,
};
const seaFcl = {
  service: 'international',
  formVersion: 'international@1',
  contact,
  operation: { operationType: 'import', serviceScope: 'shipping_customs' },
  shipment: {
    mode: 'sea',
    seaType: 'fcl',
    origin: { country: 'CN', port: { id: 'CN-SHANGHAI' } },
    destination: { country: 'EG', port: { id: 'EG-ALEXANDRIA' } },
    clearanceLocation: 'destination',
    cargo: containers,
  },
  services: { availableDocuments: ['tax_card'], executionDocuments: 'client', incoterm: 'FOB' },
  ...common,
};
const looseManual = {
  kind: 'loose',
  description: 'Spare parts',
  inputMethod: 'manual',
  items: [
    {
      description: 'Filters',
      weight: { value: '120', unit: 'kg' },
      cartons: 10,
      dimensions: { length: 50, width: 40, height: 30 },
      hazardous: false,
    },
    {
      description: 'Oil',
      weight: { value: 80, unit: 'kg' },
      cartons: 2,
      dimensions: { length: 100, width: 60, height: 50 },
      hazardous: true,
      msdsUploadId: U(1),
    },
  ],
};
const air = {
  ...seaFcl,
  operation: { operationType: 'export', serviceScope: 'shipping' },
  shipment: {
    mode: 'air',
    origin: { country: 'EG', airport: { any: true } },
    destination: { country: 'SA', airport: { id: 'JED' } },
    airService: 'door_door',
    pickupAddress: '12 Abbas El Akkad, Nasr City',
    deliveryAddress: 'Al Hamra District, Jeddah',
    cargo: looseManual,
  },
};
const landFtl = {
  ...seaFcl,
  operation: { operationType: 'export', serviceScope: 'customs' },
  shipment: {
    mode: 'land',
    landType: 'general',
    loadType: 'ftl',
    origin: { country: 'EG', city: { id: 'EG-CAIRO' } },
    destination: { country: 'LY', city: { other: 'Ajdabiya' } },
    clearancePoint: 'Salloum border',
    cargo: {
      kind: 'trucks',
      groups: [{ truckType: 'flatbed_trailer', count: 3, description: 'Steel bars' }],
      packaging: 'other',
      packagingOther: 'Steel straps',
      hazardous: false,
    },
  },
};
const domesticGeneral = {
  service: 'domestic',
  formVersion: 'domestic@1',
  contact: { ...contact, clientType: 'individual', businessName: undefined },
  shipment: {
    landType: 'general',
    loadType: 'ltl',
    loadingRegion: 'EG-C',
    unloadingRegion: 'EG-ALX',
    cargo: {
      kind: 'ltl',
      description: 'Furniture',
      inputMethod: 'packing_list',
      packingListUploadId: U(2),
      hazardous: false,
    },
  },
  services: { insurance: true, warehousing: false },
  cargoValue: { amount: '20000', currency: 'EGP' },
  ...common,
};
const chinaManual = {
  service: 'china',
  formVersion: 'china@1',
  contact: { ...contact, clientType: 'trader', businessName: undefined },
  order: {
    source: 'chinese_sites',
    chineseSite: '1688',
    addMethod: 'manual',
    products: [
      {
        url: 'https://detail.1688.com/offer/1.html',
        quantity: 5,
        colors: [
          { value: 'Red', quantity: 3 },
          { value: 'Blue', quantity: 2 },
        ],
      },
      { name: 'Phone cases', quantity: 10 },
    ],
  },
  delivery: {
    shippingMethod: 'sea',
    country: { id: 'EG' },
    city: { id: 'EG-CAIRO' },
    address: 'Building 4, Street 9, Maadi',
    receiverName: 'Wafaa Mohamed',
    receiverPhone: '+201012345678',
  },
  confirmAccuracy: true,
};

type Issues = Record<string, string[]>;
function issues(value: unknown): Issues {
  const result = orderSchema.safeParse(value);
  const map: Issues = {};
  for (const i of result.error?.issues ?? []) (map[i.path.join('.')] ??= []).push(i.message);
  return map;
}
const ok = (value: unknown) => {
  const result = orderSchema.safeParse(value);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues.slice(0, 3)));
  return result.data;
};
const clone = <T>(v: T): T => structuredClone(v);

describe('order schema: valid paths', () => {
  it.each([
    ['sea FCL', seaFcl],
    ['air door → door, manual products', air],
    ['land FTL', landFtl],
    ['domestic LTL with a packing list', domesticGeneral],
    ['China sites, manual products with colours', chinaManual],
  ])('%s', (_name, order) => {
    ok(order);
  });

  it('normalises numbers (Arabic digits, strings) and keeps the structure', () => {
    const parsed = ok(seaFcl);
    if (parsed.service !== 'international' || parsed.shipment.cargo.kind !== 'containers')
      throw new Error('path');
    expect(parsed.shipment.cargo.groups[0]).toMatchObject({
      count: 2,
      targetPrice: { amount: 1500, currency: 'USD' },
    });
  });
});

describe('order schema: rules', () => {
  it('strict: an unknown field is rejected', () => {
    expect(orderSchema.safeParse({ ...seaFcl, price: 1 }).success).toBe(false);
    const extra = clone(seaFcl);
    (extra.shipment as Record<string, unknown>).airService = 'door_door';
    expect(orderSchema.safeParse(extra).success).toBe(false);
  });

  it('demo bug: "domestic" is not an international operation type', () => {
    const order = clone(seaFcl);
    order.operation.operationType = 'domestic';
    expect(issues(order)['operation.operationType']).toEqual(['validation.required']);
  });

  it('demo bug: sea needs the clearance location when the service includes clearance', () => {
    const order = clone(seaFcl);
    delete (order.shipment as Record<string, unknown>).clearanceLocation;
    expect(issues(order)['shipment.clearanceLocation']).toEqual(['validation.required']);
    const shippingOnly = {
      ...clone(seaFcl),
      operation: { operationType: 'import', serviceScope: 'shipping' },
    };
    expect(issues(shippingOnly)['shipment.clearanceLocation']).toEqual(['validation.notAllowed']);
  });

  it('demo bug: the manual method needs at least one product', () => {
    const order = clone(air);
    order.shipment.cargo.items = [];
    expect(issues(order)['shipment.cargo.items']).toEqual(['validation.required']);
  });

  it('demo bug: domestic route fields are required (Egyptian governorates)', () => {
    const order = clone(domesticGeneral);
    delete (order.shipment as Record<string, unknown>).unloadingRegion;
    expect(issues(order)['shipment.unloadingRegion']).toEqual(['validation.required']);
    order.shipment.unloadingRegion = 'SA-01';
    expect(issues(order)['shipment.unloadingRegion']).toEqual(['validation.required']);
  });

  it('FCL needs containers, LCL needs loose cargo; target price only for sea', () => {
    const lcl = clone(seaFcl);
    lcl.shipment.seaType = 'lcl';
    expect(issues(lcl)['shipment.cargo.kind']).toEqual(['validation.required']);
    const landContainer = clone(landFtl);
    Object.assign(landContainer.shipment, {
      landType: 'container',
      loadType: undefined,
      cargo: containers,
    });
    expect(issues(landContainer)['shipment.cargo.groups.0.targetPrice']).toEqual([
      'validation.notAllowed',
    ]);
  });

  it('hazardous needs an MSDS (per product for manual products)', () => {
    const order = clone(air);
    delete (order.shipment.cargo.items[1] as Record<string, unknown>).msdsUploadId;
    expect(issues(order)['shipment.cargo.items.1.msdsUploadId']).toEqual(['validation.required']);
  });

  it('door services need their addresses; airport ones refuse them', () => {
    const order = clone(air);
    order.shipment.airService = 'airport_airport';
    const r = issues(order);
    expect(r['shipment.pickupAddress']).toEqual(['validation.notAllowed']);
    expect(r['shipment.deliveryAddress']).toEqual(['validation.notAllowed']);
  });

  it('insurance needs the cargo value; the ready date cannot be in the past', () => {
    const order = clone(domesticGeneral);
    delete (order as Record<string, unknown>).cargoValue;
    expect(issues(order).cargoValue).toEqual(['validation.required']);
    expect(issues({ ...seaFcl, readyDate: '2020-01-01' }).readyDate).toEqual([
      'validation.readyDate',
    ]);
    expect(issues({ ...seaFcl, readyDate: cairoToday() }).readyDate).toBeUndefined();
  });

  it('client type: company needs a name; individual refuses one; WhatsApp if not the same', () => {
    const order = clone(seaFcl);
    order.contact = { ...contact, businessName: undefined as never, whatsappSameAsPhone: false };
    const r = issues(order);
    expect(r['contact.businessName']).toEqual(['validation.required']);
    expect(r['contact.whatsapp']).toEqual(['validation.required']);
  });

  it('China: colour / size quantities must add up; name or URL; HTTPS cart link', () => {
    const order = clone(chinaManual);
    order.order.products[0]!.colors = [{ value: 'Red', quantity: 1 }];
    order.order.products[1] = { quantity: 2 } as never;
    const r = issues(order);
    expect(r['order.products.0.colors']).toEqual(['validation.quantitiesMustMatch']);
    expect(r['order.products.1.name']).toEqual(['validation.productNameOrUrl']);
    const link = {
      ...clone(chinaManual),
      order: {
        source: 'shein',
        sheinSite: 'shein_sa',
        addMethod: 'cart_link',
        cartLink: 'http://shein.com/cart',
      },
    };
    link.delivery.shippingMethod = 'air';
    expect(issues(link)['order.cartLink']).toEqual(['validation.httpsUrl']);
    link.order.cartLink = 'https://shein.com/cart/abc';
    expect(issues(link)).toEqual({});
  });

  it('China: SHEIN ships by air or land only; screenshots 1–10', () => {
    const order = {
      ...clone(chinaManual),
      order: {
        source: 'shein',
        sheinSite: 'shein_ae',
        addMethod: 'screenshots',
        screenshotUploadIds: [],
      },
    };
    const r = issues(order);
    expect(r['delivery.shippingMethod']).toEqual(['validation.required']); // sea
    expect(r['order.screenshotUploadIds']).toEqual(['validation.required']);
  });
});

describe('attachments + derived values', () => {
  it('collects every referenced upload with its slot (MSDS per product keeps the position)', () => {
    const order = clone(air);
    Object.assign(order, { shipmentDocuments: { commercialInvoice: [U(3)], draftBl: [U(4)] } });
    expect(collectAttachments(ok(order))).toEqual([
      { uploadId: U(1), slot: 'item_msds', itemPosition: 1 },
      { uploadId: U(3), slot: 'commercial_invoice' },
      { uploadId: U(4), slot: 'draft_bl' },
    ]);
    expect(collectAttachments(ok(domesticGeneral))).toEqual([
      { uploadId: U(2), slot: 'cargo_packing_list' },
    ]);
  });

  it('CBM, air volumetric weight and totals are computed, never sent', () => {
    expect(deriveOrderValues(ok(air))).toEqual({
      items: [
        { cbm: 0.6, volumetricKg: 100 },
        { cbm: 0.6, volumetricKg: 100 },
      ],
      totalContainers: null,
      totalTrucks: null,
      totalCbm: 1.2,
    });
    expect(deriveOrderValues(ok(seaFcl)).totalContainers).toBe(2);
    expect(deriveOrderValues(ok(landFtl)).totalTrucks).toBe(3);
  });
});
