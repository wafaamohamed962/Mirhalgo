import { describe, expect, it } from 'vitest';
import { orderSchemas } from '@mirhalgo/shared';
import type { TFunction } from 'i18next';
import {
  UI_ONLY_KEYS,
  emptyValues,
  orderIssues,
  stepOfIssue,
  uploadIdsIn,
} from '../src/features/requests/model';
import { hiddenPaths, pruneOrder } from '../src/features/requests/prune';
import { summarize } from '../src/features/requests/summary';

/* MW_003 B5: raw form values → the order of the chosen path (pure parts of the forms). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form order trees in assertions
type Json = Record<string, any>;
const MSDS = '11111111-1111-4111-8111-111111111111';
const INVOICE = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';

const prefill = { fullName: 'Wafaa Mohamed', phone: '+201098765432' };
const contact = {
  ...emptyValues('international', prefill).contact,
  clientType: 'company',
  businessName: 'Acme',
};

/** International sea FCL with leftovers of other paths (air service, LCL items, …). */
const seaFcl = () => ({
  ...emptyValues('international', prefill),
  contact,
  operation: { operationType: 'import', serviceScope: 'shipping_customs' },
  shipment: {
    mode: 'sea',
    seaType: 'fcl',
    airService: 'door_door', // left over from air
    pickupAddress: 'old address',
    origin: { country: 'CN', port: { id: 'CN-SHANGHAI' }, airport: { any: true } },
    destination: { country: 'EG', port: { isOther: true, other: 'Port Said West' } },
    clearanceLocation: 'destination',
    truckingNeeded: false,
    trucking: { side: 'both', originAddress: 'x' },
    cargo: {
      groups: [
        {
          containerType: '40_high_cube',
          count: '٢',
          description: 'Furniture',
          shippingLine: { id: '' },
        },
      ],
      items: [{ cartons: '1', weight: { unit: 'kg' } }],
      description: 'LCL leftover',
      inputMethod: 'manual',
      hazardous: 'yes',
      msdsUploadId: MSDS,
    },
  },
  services: {
    availableDocuments: ['tax_card'],
    executionDocuments: 'client',
    insurance: false,
    warehousing: true,
    incoterm: 'FOB',
  },
  readyDate: '2099-03-01',
  shipmentDocuments: { commercialInvoice: [INVOICE], packingList: [], draftBl: [], other: [] },
  confirmAccuracy: true,
});

describe('pruneOrder', () => {
  it('international sea FCL keeps only that path and passes the shared schema', () => {
    const order = pruneOrder('international', seaFcl()) as Json;
    expect(order.shipment).toEqual({
      mode: 'sea',
      seaType: 'fcl',
      origin: { country: 'CN', port: { id: 'CN-SHANGHAI' } },
      destination: { country: 'EG', port: { other: 'Port Said West' } },
      clearanceLocation: 'destination',
      cargo: {
        kind: 'containers',
        groups: [{ containerType: '40_high_cube', count: '٢', description: 'Furniture' }],
        hazardous: true,
        msdsUploadId: MSDS,
      },
    });
    expect(order.services.incoterm).toBe('FOB');
    const parsed = orderSchemas.international.safeParse(order);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('customs scope off → no clearance location; air door-to-door keeps both addresses and "any airport"', () => {
    const raw = seaFcl();
    raw.operation.serviceScope = 'shipping';
    raw.shipment = {
      ...raw.shipment,
      mode: 'air',
      airService: 'door_door',
      pickupAddress: 'Factory 7, Ningbo',
      deliveryAddress: 'Warehouse 3, 6th of October',
      destination: { country: 'EG', airport: { id: 'CAI' } } as never,
    };
    const shipment = (pruneOrder('international', raw) as Json).shipment;
    expect(shipment).toMatchObject({
      mode: 'air',
      origin: { country: 'CN', airport: { any: true } },
      destination: { country: 'EG', airport: { id: 'CAI' } },
      pickupAddress: 'Factory 7, Ningbo',
      deliveryAddress: 'Warehouse 3, 6th of October',
      cargo: { kind: 'loose', inputMethod: 'manual' },
    });
    expect(shipment).not.toHaveProperty('clearanceLocation');
    expect(shipment).not.toHaveProperty('seaType');
  });

  it('a whatsapp number and business name are dropped when their switch hides them', () => {
    const raw = seaFcl();
    raw.contact = {
      ...contact,
      clientType: 'individual',
      whatsappSameAsPhone: true,
      whatsapp: '+201000000000',
    };
    const order = pruneOrder('international', raw) as Json;
    expect(order.contact).toEqual({
      fullName: 'Wafaa Mohamed',
      phone: '+201098765432',
      whatsappSameAsPhone: true,
      clientType: 'individual',
    });
  });

  it('china manual products: colours / sizes only when switched on', () => {
    const raw = {
      ...emptyValues('china', prefill),
      order: {
        source: 'chinese_sites',
        chineseSite: 'alibaba',
        sheinSite: 'shein_sa', // other source: dropped
        addMethod: 'manual',
        cartLink: 'https://old', // other method: dropped
        products: [
          {
            name: 'Lamp',
            quantity: '3',
            hasColors: true,
            colors: [{ value: 'Red', quantity: '3' }],
            hasSizes: false,
            sizes: [{ value: 'L', quantity: '1' }],
          },
        ],
      },
    };
    const order = (pruneOrder('china', raw) as Json).order;
    expect(order).toEqual({
      source: 'chinese_sites',
      chineseSite: 'alibaba',
      addMethod: 'manual',
      products: [{ name: 'Lamp', quantity: '3', colors: [{ value: 'Red', quantity: '3' }] }],
    });
  });
});

describe('hiddenPaths', () => {
  it('lists the raw values the chosen path does not show (UI flags are kept)', () => {
    const raw = seaFcl();
    const paths = hiddenPaths(raw, pruneOrder('international', raw), UI_ONLY_KEYS);
    expect(paths).toEqual(
      expect.arrayContaining([
        'shipment.airService',
        'shipment.pickupAddress',
        'shipment.origin.airport',
        'shipment.trucking',
        'shipment.cargo.items',
        'shipment.cargo.description',
        'shipment.cargo.inputMethod',
        'shipment.cargo.groups.0.shippingLine',
      ]),
    );
    expect(paths).not.toContain('shipment.truckingNeeded');
    expect(paths).not.toContain('shipment.cargo.groups.0.containerType');
    expect(paths.some((p) => p.startsWith('contact.'))).toBe(false);
  });
});

describe('model helpers', () => {
  it('stepOfIssue maps schema paths to the step that shows them', () => {
    expect(stepOfIssue('international', ['contact', 'fullName'])).toBe('customer');
    expect(stepOfIssue('international', ['shipment', 'mode'])).toBe('operation');
    expect(stepOfIssue('international', ['shipment', 'origin', 'port'])).toBe('route');
    expect(stepOfIssue('international', ['shipment', 'cargo', 'groups', 0, 'count'])).toBe('cargo');
    expect(stepOfIssue('international', ['readyDate'])).toBe('cargo');
    expect(stepOfIssue('domestic', ['services', 'executionDocuments'])).toBe('services');
    expect(stepOfIssue('china', ['order', 'products', 0, 'quantity'])).toBe('order');
    expect(stepOfIssue('china', ['delivery', 'city'])).toBe('delivery');
    expect(stepOfIssue('china', ['confirmAccuracy'])).toBe('review');
  });

  it('orderIssues: a step sees its cross-field errors while the later steps are still empty', () => {
    // regression: Zod skips the rules while any field is missing, so "Next" on Cargo let a
    // hazardous cargo without its MSDS through (the error only came at the final submit)
    const raw = seaFcl();
    delete (raw.shipment.cargo as Json).msdsUploadId;
    raw.services = { availableDocuments: [], insurance: false, warehousing: false } as never;
    (raw as Json).confirmAccuracy = undefined;
    const order = pruneOrder('international', raw) as Json;
    expect(orderIssues('international', order, 'cargo')).toEqual([
      { path: ['shipment', 'cargo', 'msdsUploadId'], message: 'validation.required' },
    ]);
    // the field errors of the step come first; other steps never leak in
    expect(orderIssues('international', order, 'route')).toEqual([]);
    expect(orderIssues('international', order, 'services').map((i) => i.path)).toEqual([
      ['services', 'executionDocuments'],
    ]);
  });

  it('uploadIdsIn finds every upload the form refers to', () => {
    const raw = seaFcl();
    raw.shipment.cargo.items = [
      { cartons: '1', weight: { unit: 'kg' }, msdsUploadId: ITEM } as never,
    ];
    expect(uploadIdsIn(raw).sort()).toEqual([INVOICE, ITEM, MSDS].sort());
    expect(uploadIdsIn({ order: { screenshotUploadIds: ['a', 'b'] } })).toEqual(['a', 'b']);
  });
});

describe('summarize', () => {
  it('groups readable rows by step: option labels, reference names, "Other", file names', () => {
    const t = ((key: string) => key) as unknown as TFunction;
    const sections = summarize('international', pruneOrder('international', seaFcl()) as never, {
      t,
      language: 'en',
      names: (list, id) => (list === 'ports' && id === 'CN-SHANGHAI' ? 'Shanghai' : undefined),
      uploads: { [INVOICE]: { id: INVOICE, name: 'invoice.pdf' } as never },
    });
    const route = sections.get('route') ?? [];
    expect(route).toContainEqual({
      label: 'portal.request.fields.origin · portal.request.fields.port',
      value: 'Shanghai',
    });
    expect(route.some((r) => r.value.startsWith('Port Said West'))).toBe(true);
    expect(sections.get('cargo')).toContainEqual({
      label: 'portal.request.fields.commercialInvoice',
      value: 'invoice.pdf',
    });
    expect(sections.get('operation')).toContainEqual({
      label: 'portal.request.fields.mode',
      value: 'portal.request.options.mode.sea',
    });
  });
});
