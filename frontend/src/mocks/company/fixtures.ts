import {
  cairoToday,
  orderSchema,
  type CompanyOrderStatus,
  type CompanyOfferStatus,
  type OfferTemplate,
  type OfferValues,
  type Order,
} from '@mirhalgo/shared';

/*
 * Company portal fixtures (MW_004 B1). Fictional companies, clients and orders, in formal
 * Arabic (decision 23). Built relative to `now` the first time an account opens the portal,
 * then persisted (mocks/company/db.ts), so the demo never looks stale and survives a reload.
 * Every order is a real, valid order (the shared `orderSchema`): the details modal shows it
 * with the same summary as the New Request review step.
 */

export const SELF_ID = 'self';

/** Ours + 5 competitors; two of them hide their offers (spec B1). */
export const COMPANIES = [
  {
    id: SELF_ID,
    legalName: 'أليكس إكسبريس للشحن الدولي واللوجستيات',
    alias: 'الناقل الذهبي',
    hideOffers: false,
  },
  { id: 'co_nile', legalName: 'النيل للشحن البحري', alias: null, hideOffers: false },
  { id: 'co_delta', legalName: 'دلتا للنقل البري', alias: null, hideOffers: false },
  { id: 'co_sky', legalName: 'السماء للشحن الجوي', alias: 'سكاي', hideOffers: true },
  { id: 'co_red', legalName: 'البحر الأحمر للخدمات اللوجستية', alias: null, hideOffers: false },
  { id: 'co_east', legalName: 'الشرق للتجارة والشحن', alias: null, hideOffers: true },
] as const;
const COMPETITORS = COMPANIES.slice(1).map((c) => c.id);

/** Our own settings before any change (GET /company/me). */
export const SELF_DEFAULTS = {
  contactPhone: '+201000000001',
  offerSubmission: 'allowed' as const,
  hideOffers: false,
  /** On-time delivery rate: no delivery data in this task (plan Q17). */
  onTimeRate: 94,
};

// ── clients (removed from every company response by toCompanyOrder) ─────────────────────

const CLIENTS = [
  { fullName: 'منى عبد الرحمن', phone: '+201011112222', businessName: 'مؤسسة الأمل للتجارة' },
  { fullName: 'كريم حسن', phone: '+201022223333', businessName: 'شركة الوادي للأجهزة' },
  { fullName: 'سارة محمود', phone: '+201033334444', businessName: 'مصنع النور للملابس' },
  { fullName: 'أحمد يوسف', phone: '+201044445555', businessName: 'شركة الفجر للأغذية' },
];
const contactOf = (i: number) => ({
  ...CLIENTS[i % CLIENTS.length],
  whatsappSameAsPhone: true,
  clientType: 'company',
});

const GOODS = [
  'بلاط سيراميك',
  'قطع غيار سيارات',
  'أجهزة منزلية صغيرة',
  'ملابس جاهزة',
  'مواد غذائية معلبة',
  'أثاث مكتبي',
  'أقمشة قطنية',
  'مستلزمات طبية',
];
const goods = (i: number) => GOODS[i % GOODS.length]!;

// ── the 28 orders (6 categories) ─────────────────────────────────────────────────────────

type Kind = 'sea' | 'air' | 'land' | 'domestic' | 'domesticFtl' | 'shein' | 'china';
const KINDS: Kind[] = ['sea', 'air', 'domestic', 'sea', 'land', 'shein', 'china', 'domesticFtl'];

const SEA_ROUTES = [
  ['CN', 'CN-SHANGHAI', 'EG', 'EG-ALEXANDRIA'],
  ['CN', 'CN-NINGBO', 'EG', 'EG-DAMIETTA'],
  ['TR', 'TR-MERSIN', 'EG', 'EG-ALEXANDRIA'],
  ['EG', 'EG-ALEXANDRIA', 'SA', 'SA-JEDDAH'],
] as const;
const AIR_ROUTES = [
  ['CN', 'PVG', 'EG', 'CAI'],
  ['EG', 'CAI', 'AE', 'DXB'],
  ['TR', 'IST', 'EG', 'CAI'],
] as const;
const LAND_ROUTES = [
  ['EG', 'EG-CAIRO', 'LY', 'LY-BENGHAZI'],
  ['EG', 'EG-ALEXANDRIA', 'SA', 'SA-RIYADH'],
  ['EG', 'EG-CAIRO', 'JO', 'JO-AMMAN'],
] as const;
const REGIONS = ['EG-C', 'EG-ALX', 'EG-GZ', 'EG-SUZ', 'EG-DK', 'EG-AST'];

function orderInput(kind: Kind, i: number, readyDate: string) {
  const contact = contactOf(i);
  const common = { readyDate, confirmAccuracy: true as const };
  const sea = SEA_ROUTES[i % SEA_ROUTES.length]!;
  const airRoute = AIR_ROUTES[i % AIR_ROUTES.length]!;
  const land = LAND_ROUTES[i % LAND_ROUTES.length]!;
  const services = { availableDocuments: ['tax_card'], executionDocuments: 'shipping_company' };
  switch (kind) {
    case 'sea':
      return {
        service: 'international',
        formVersion: 'international@1',
        contact,
        operation: {
          operationType: sea[0] === 'EG' ? 'export' : 'import',
          serviceScope: 'shipping_customs',
        },
        shipment: {
          mode: 'sea',
          seaType: 'fcl',
          origin: { country: sea[0], port: { id: sea[1] } },
          destination: { country: sea[2], port: { id: sea[3] } },
          clearanceLocation: sea[0] === 'EG' ? 'origin' : 'destination',
          cargo: {
            kind: 'containers',
            groups: [
              {
                containerType: i % 2 ? '40_high_cube' : '20_standard',
                count: 1 + (i % 3),
                description: goods(i),
                targetPrice: { amount: 1500 + i * 20, currency: 'USD' },
              },
            ],
            hazardous: false,
          },
        },
        services: { ...services, incoterm: 'FOB' },
        ...common,
      };
    case 'air':
      return {
        service: 'international',
        formVersion: 'international@1',
        contact,
        operation: {
          operationType: airRoute[0] === 'EG' ? 'export' : 'import',
          serviceScope: 'shipping',
        },
        shipment: {
          mode: 'air',
          origin: { country: airRoute[0], airport: { id: airRoute[1] } },
          destination: { country: airRoute[2], airport: { id: airRoute[3] } },
          airService: 'airport_airport',
          cargo: {
            kind: 'loose',
            description: goods(i),
            inputMethod: 'manual',
            items: [
              {
                description: goods(i),
                weight: { value: 80 + i * 5, unit: 'kg' },
                cartons: 4 + (i % 5),
                dimensions: { length: 60, width: 40, height: 40 },
                hazardous: false,
              },
            ],
          },
        },
        services: { ...services, incoterm: 'EXW' },
        ...common,
      };
    case 'land':
      return {
        service: 'international',
        formVersion: 'international@1',
        contact,
        operation: { operationType: 'export', serviceScope: 'shipping_customs' },
        shipment: {
          mode: 'land',
          landType: 'general',
          loadType: 'ftl',
          origin: { country: land[0], city: { id: land[1] } },
          destination: { country: land[2], city: { id: land[3] } },
          clearancePoint: 'منفذ السلوم',
          cargo: {
            kind: 'trucks',
            groups: [{ truckType: 'flatbed_trailer', count: 1 + (i % 2), description: goods(i) }],
            packaging: 'pallets',
            hazardous: false,
          },
        },
        services: { ...services, incoterm: 'DAP' },
        ...common,
      };
    case 'domestic':
    case 'domesticFtl':
      return {
        service: 'domestic',
        formVersion: 'domestic@1',
        contact: { ...contact, clientType: 'individual', businessName: undefined },
        shipment: {
          landType: 'general',
          loadType: kind === 'domestic' ? 'ltl' : 'ftl',
          loadingRegion: REGIONS[i % REGIONS.length],
          unloadingRegion: REGIONS[(i + 1) % REGIONS.length],
          cargo:
            kind === 'domestic'
              ? {
                  kind: 'ltl',
                  description: goods(i),
                  inputMethod: 'manual',
                  totalWeight: { value: 300 + i * 25, unit: 'kg' },
                  pieces: 6 + (i % 7),
                  hazardous: false,
                }
              : {
                  kind: 'trucks',
                  groups: [{ truckType: 'flatbed_trailer', count: 1, description: goods(i) }],
                  packaging: 'cartons',
                  hazardous: false,
                },
        },
        services: { insurance: false, warehousing: false },
        ...common,
      };
    case 'shein':
    case 'china':
      return {
        service: 'china',
        formVersion: 'china@1',
        contact: { ...contact, clientType: 'trader', businessName: undefined },
        order:
          kind === 'shein'
            ? {
                source: 'shein',
                sheinSite: i % 2 ? 'shein_ae' : 'shein_sa',
                addMethod: 'cart_link',
                cartLink: `https://shein.example/cart/${1000 + i}`,
              }
            : {
                source: 'chinese_sites',
                chineseSite: i % 2 ? '1688' : 'alibaba',
                addMethod: 'manual',
                products: [
                  { name: 'حافظات هواتف', quantity: 20 + i },
                  { name: 'سماعات لاسلكية', quantity: 10 },
                ],
              },
        delivery: {
          shippingMethod: 'air',
          country: { id: 'EG' },
          city: { id: 'EG-CAIRO' },
          address: 'شارع التسعين، التجمع الخامس، القاهرة',
          receiverName: contact.fullName,
          receiverPhone: contact.phone,
        },
        confirmAccuracy: true,
      };
  }
}

/** Order ids MG1029 (newest) … MG1002. */
const REF_OF = (i: number) => `MG${1029 - i}`;
const AWARDED = new Set([14, 17]);
const COMPLETED = new Set([20, 23, 26]);
const CANCELLED = new Set([11]);
/** Orders the administration assigned to other companies only: we never see them. */
const NOT_ASSIGNED_TO_US = new Set([5, 9, 19, 24, 27]);

// ── offers ──────────────────────────────────────────────────────────────────────────────

/** Our offers: order index → statuses (one order has two offers: several are allowed). */
const OUR_OFFERS: Record<number, CompanyOfferStatus[]> = {
  1: ['under_review'],
  2: ['under_review'],
  4: ['under_review'],
  6: ['under_review'],
  7: ['rejected'],
  8: ['rejected', 'under_review'],
  10: ['under_review'],
  13: ['under_review'],
  14: ['accepted'],
  17: ['rejected'],
  18: ['under_review'],
  20: ['accepted'],
  21: ['under_review'],
  22: ['under_review'],
  23: ['accepted'],
  25: ['under_review'],
  26: ['rejected'],
};
const REJECTION_REASONS = [
  'السعر أعلى من العروض الأخرى المقدمة على الطلب.',
  'مدة النقل أطول مما يحتاجه العميل.',
];

const TEMPLATE_OF_KIND: Record<Kind, OfferTemplate> = {
  sea: 'sea',
  air: 'air',
  land: 'international_land',
  domestic: 'domestic_land',
  domesticFtl: 'domestic_land',
  shein: 'china',
  china: 'china',
};

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A realistic offer for a template; `factor` varies competitors around our price. */
function offerValues(
  template: OfferTemplate,
  i: number,
  factor: number,
  today: string,
): OfferValues {
  const round = (n: number) => Math.round(n * factor);
  switch (template) {
    case 'sea':
      return {
        template,
        details: {
          oceanFreight: { amount: round(1400 + i * 30), currency: 'USD' },
          thc: { amount: round(4500), currency: 'EGP' },
          blFee: { amount: 75, currency: 'USD' },
          transitDays: 25 + (i % 6),
          freeDays: 14,
          departureDate: addDays(today, 7 + (i % 5)),
        },
        total: {
          foreign: { amount: round(1500 + i * 30), currency: 'USD' },
          egp: round(12000 + i * 150),
        },
      };
    case 'air':
      return {
        template,
        details: {
          airFreightCost: { amount: round(3.2 * (80 + i * 5)), currency: 'USD' },
          airline: 'مصر للطيران',
          flightDate: addDays(today, 3 + (i % 4)),
          transitDays: 2 + (i % 3),
        },
        total: { foreign: { amount: round(850 + i * 25), currency: i % 2 ? 'EUR' : 'USD' } },
      };
    case 'international_land':
      return {
        template,
        details: {
          vehicleType: 'flatbed_trailer',
          transportCost: { amount: round(2400 + i * 40), currency: 'USD' },
          transitDays: 6 + (i % 4),
          loadingDate: addDays(today, 5),
          borderCrossing: 'منفذ السلوم',
        },
        total: { foreign: { amount: round(2600 + i * 40), currency: 'USD' }, egp: round(9000) },
      };
    case 'domestic_land':
      return {
        template,
        details: {
          vehicleType: 'flatbed_trailer',
          transportCost: { amount: round(6000 + i * 120), currency: 'EGP' },
          transitDays: 1 + (i % 2),
          loadingDate: addDays(today, 2),
          notes: 'التحميل من المستودع مباشرة، ويشمل السعر التفريغ.',
        },
        total: { egp: round(6500 + i * 120) },
      };
    case 'china':
      return {
        template,
        details: {
          weightCost: { amount: round(1800 + i * 40), currency: 'EGP' },
          productPurchaseCost: { amount: round(1500 + i * 30), currency: 'EGP' },
          shippingDays: 12 + (i % 4),
        },
        total: { egp: round(3400 + i * 70) },
      };
  }
}

// ── inquiries ─────────────────────────────────────────────────────────────────────────────

/** Order index → question (and our reply, once sent). All on orders where we offered. */
const INQUIRIES: Array<{ order: number; question: string; reply?: string }> = [
  { order: 1, question: 'هل يشمل السعر التخليص الجمركي في ميناء الوصول؟' },
  { order: 2, question: 'ما المدة المتوقعة لوصول الشحنة بعد المغادرة؟' },
  { order: 4, question: 'هل يمكن تأمين البضاعة ضد التلف أثناء النقل؟' },
  { order: 6, question: 'هل السعر نهائي أم قابل للمراجعة عند زيادة الكمية؟' },
  { order: 8, question: 'هل تتوفر خدمة التوصيل إلى المستودع مباشرة؟' },
  { order: 10, question: 'ما المستندات المطلوبة مني قبل الشحن؟' },
  {
    order: 13,
    question: 'هل يمكن تقسيم الشحنة على دفعتين؟',
    reply: 'نعم، يمكن تقسيم الشحنة على دفعتين دون تكلفة إضافية على النقل الداخلي.',
  },
  {
    order: 18,
    question: 'هل تشمل التكلفة رسوم التخزين في الميناء؟',
    reply: 'تشمل التكلفة سبعة أيام تخزين مجانية، وبعدها تُحسب الرسوم حسب لائحة الميناء.',
  },
  {
    order: 21,
    question: 'متى يمكن استلام البضاعة من المورد؟',
    reply: 'يمكن الاستلام خلال يومي عمل من تأكيد العرض.',
  },
  {
    order: 22,
    question: 'هل يمكن تغيير موعد التحميل إلى الأسبوع القادم؟',
    reply: 'نعم، يمكن تغيير الموعد بشرط إبلاغنا قبل ثمانٍ وأربعين ساعة.',
  },
];

// ── the generated data set ──────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

export type MockCompanyOrder = {
  id: string;
  order: Order;
  createdAt: string;
  /** When the administration assigned it (average response time, spec B3). */
  assignedAt: string;
  status: CompanyOrderStatus;
  /** Companies the administration assigned the order to. */
  assignedTo: string[];
  attachments: Array<{ name: string; slot: string }>;
};

export type MockOffer = OfferValues & {
  id: string;
  orderId: string;
  companyId: string;
  status: CompanyOfferStatus;
  createdAt: string;
  updatedAt: string;
  rejectionReason: string | null;
};

export type MockInquiry = {
  id: string;
  orderId: string;
  question: string;
  createdAt: string;
  reply: { text: string; sentAt: string } | null;
};

/** The fixture data set, dated relative to `now` (ids counted from 100001, never reused). */
export function buildFixtures(now = Date.now()) {
  const today = cairoToday(new Date(now));
  const orders: MockCompanyOrder[] = [];
  const offers: MockOffer[] = [];
  let offerSeq = 100000;
  const nextOfferId = () => `OF-${++offerSeq}`;

  for (let i = 0; i < 28; i++) {
    const kind = KINDS[i % KINDS.length]!;
    const created = now - (i * 31 + 2) * HOUR;
    const status: CompanyOrderStatus = AWARDED.has(i)
      ? 'awarded'
      : COMPLETED.has(i)
        ? 'completed'
        : CANCELLED.has(i)
          ? 'cancelled'
          : 'open';
    // other companies offering on this order (and assigned to it)
    const others = i % 4 === 3 ? [] : [COMPETITORS[i % 5]!, COMPETITORS[(i + 2) % 5]!];
    if (i % 6 === 0) others.push(COMPETITORS[(i + 4) % 5]!);
    const id = REF_OF(i);
    orders.push({
      id,
      order: orderSchema.parse(orderInput(kind, i, addDays(today, 10))),
      createdAt: iso(created),
      assignedAt: iso(created + HOUR),
      status,
      assignedTo: [...(NOT_ASSIGNED_TO_US.has(i) ? [] : [SELF_ID]), ...new Set(others)],
      attachments: kind === 'sea' ? [{ name: 'commercial-invoice.pdf', slot: 'invoice' }] : [],
    });

    const template = TEMPLATE_OF_KIND[kind];
    const ourStatuses = OUR_OFFERS[i] ?? [];
    const ourAccepted = ourStatuses.includes('accepted');
    ourStatuses.forEach((offerStatus, k) => {
      const at = created + HOUR + (3 + (i % 9) + k * 20) * HOUR;
      offers.push({
        ...offerValues(template, i, 1 - k * 0.05, today),
        id: nextOfferId(),
        orderId: id,
        companyId: SELF_ID,
        status: offerStatus,
        createdAt: iso(at),
        updatedAt: iso(at),
        rejectionReason:
          offerStatus === 'rejected' ? REJECTION_REASONS[i % REJECTION_REASONS.length]! : null,
      });
    });
    [...new Set(others)].forEach((companyId, k) => {
      const at = created + HOUR + (5 + k * 4) * HOUR;
      const decided = status !== 'open' && status !== 'cancelled';
      const accepted = decided && !ourAccepted && k === 0;
      offers.push({
        ...offerValues(template, i, 1 + (k % 2 ? -0.06 : 0.08) + k * 0.02, today),
        id: nextOfferId(),
        orderId: id,
        companyId,
        status: accepted ? 'accepted' : decided ? 'rejected' : 'under_review',
        createdAt: iso(at),
        updatedAt: iso(at),
        rejectionReason: decided && !accepted ? REJECTION_REASONS[0]! : null,
      });
    });
  }

  let inquirySeq = 100000;
  const inquiries: MockInquiry[] = INQUIRIES.map(({ order, question, reply }) => {
    const firstOffer = offers.find((o) => o.orderId === REF_OF(order) && o.companyId === SELF_ID)!;
    const asked = Math.min(Date.parse(firstOffer.createdAt) + 6 * HOUR, now - HOUR);
    return {
      id: `IQ-${++inquirySeq}`,
      orderId: REF_OF(order),
      question,
      createdAt: iso(asked),
      reply: reply ? { text: reply, sentAt: iso(Math.min(asked + 3 * HOUR, now)) } : null,
    };
  });

  return { orders, offers, inquiries, offerSeq, inquirySeq };
}
