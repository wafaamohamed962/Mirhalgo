import { cairoToday } from '../src/index.js';

/* Valid order inputs of every kind (MW_003 B4), shared by the order and company portal tests. */

export const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const tomorrow = () => {
  const d = new Date(`${cairoToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export const contact = {
  fullName: 'Wafaa Mohamed',
  phone: '+201012345678',
  whatsappSameAsPhone: true,
  clientType: 'company',
  businessName: 'Nile Imports',
};
export const common = {
  readyDate: tomorrow(),
  confirmAccuracy: true,
};
export const containers = {
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
export const seaFcl = {
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
export const looseManual = {
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
export const air = {
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
export const landFtl = {
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
export const domesticGeneral = {
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
export const chinaManual = {
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
