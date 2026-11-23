import type {
  Address,
  AppNotification,
  BalanceEntry,
  CompanyProfile,
  DeviceSession,
  LoginActivity,
  Me,
  NotificationPrefs,
  Offer,
  OrderDetails,
  OrderStatus,
  Review,
  ServiceType,
  Ticket,
  TimelineStep,
} from '@mirhalgo/shared';

/*
 * Realistic fixtures for the customer portal mocks (MW_002 B2). Every company, person and
 * number here is fictional. Dates are relative to "now" so the demo always looks recent.
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
export const ago = (ms: number, now = Date.now()) => new Date(now - ms).toISOString();

export const me: Me = {
  id: 'cus_1',
  firstName: 'منى',
  lastName: 'عادل',
  gender: 'female',
  email: 'mona.adel@example.com',
  phone: '+201012345678',
  avatarUrl: null,
};

export const ATTEMPTS_TOTAL = 5;
export const attemptsRemaining = 3;

// ── companies ──────────────────────────────────────────────────────────────

const company = (
  id: string,
  name: string,
  categories: CompanyProfile['categories'],
  rating: number,
  reviewsCount: number,
  completedOrders: number,
  extra: Partial<CompanyProfile> = {},
): CompanyProfile => ({
  id,
  name,
  logoUrl: null,
  categories,
  rating,
  reviewsCount,
  completedOrders,
  topRated: rating >= 4.7 && reviewsCount >= 40,
  about: 'شركة شحن وتخليص جمركي تخدم المستوردين والتجار في مصر، مع فريق متابعة حتى وصول الشحنة.',
  yearsInBusiness: 8,
  services: ['door_to_door', 'tracking', 'insurance'],
  coveredGovernorates: ['cairo', 'giza', 'alexandria'],
  allGovernorates: false,
  canRate: false,
  myRating: null,
  ...extra,
});

export const companies: CompanyProfile[] = [
  company('co_nile', 'Nile Bridge Logistics', ['international', 'customs'], 4.8, 126, 412, {
    yearsInBusiness: 14,
    services: ['sea_freight', 'air_freight', 'customs_clearance', 'door_to_door'],
    canRate: true,
  }),
  company('co_delta', 'دلتا للشحن والنقل', ['domestic'], 4.6, 88, 960, {
    services: ['door_to_door', 'same_day', 'tracking'],
    allGovernorates: true,
    coveredGovernorates: [],
  }),
  company('co_dragon', 'Red Dragon Sourcing', ['china'], 4.9, 203, 1350, {
    services: ['purchasing', 'consolidation', 'air_freight'],
    canRate: true,
    myRating: null,
  }),
  company('co_pharos', 'فاروس للتخليص الجمركي', ['customs'], 4.4, 47, 230, {
    services: ['customs_clearance', 'documents'],
    coveredGovernorates: ['alexandria', 'port_said', 'suez'],
  }),
  company('co_sinai', 'Sinai Express', ['domestic'], 4.1, 35, 310, {
    coveredGovernorates: ['north_sinai', 'south_sinai', 'ismailia', 'suez'],
  }),
  company('co_lotus', 'Lotus Freight', ['international'], 4.7, 64, 280, {
    services: ['air_freight', 'insurance', 'tracking'],
  }),
  company('co_gate', 'بوابة الصين للتسوق', ['china'], 4.5, 151, 2210, {
    services: ['purchasing', 'consolidation', 'door_to_door'],
  }),
  company('co_horus', 'Horus Global Shipping', ['international', 'customs'], 4.3, 29, 145),
  company('co_upper', 'الصعيد للنقل البري', ['domestic'], 4.2, 41, 520, {
    coveredGovernorates: ['minya', 'asyut', 'sohag', 'qena', 'luxor', 'aswan'],
  }),
  company('co_canal', 'Canal Line Cargo', ['international', 'domestic'], 3.9, 18, 96),
  company('co_yangtze', 'Yangtze Link', ['china', 'customs'], 4.6, 72, 640),
  company('co_alex', 'Alex Port Services', ['customs', 'international'], 4.0, 22, 133),
];

export const reviews: Record<string, Review[]> = {
  co_nile: [
    review('r1', 'أحمد م.', 5, 'اكتمل التخليص في يومين، وكان التواصل ممتازًا.', 3 * DAY, 18, 1),
    review(
      'r2',
      'Sara K.',
      4,
      'Good price and updates every day. Delivery was one day late.',
      9 * DAY,
      7,
      2,
    ),
    review('r3', 'محمود ع.', 5, 'أفضل شركة تعاملت معها في الشحن البحري.', 20 * DAY, 25, 0),
  ],
  co_dragon: [
    review(
      'r4',
      'نور هـ.',
      5,
      'جمعوا طلبات شي إن في شحنة واحدة ووفّروا عليّ الكثير.',
      2 * DAY,
      31,
      0,
    ),
    review('r5', 'Omar T.', 4, 'Reliable, but the consolidation took a week.', 15 * DAY, 4, 1),
  ],
};

function review(
  id: string,
  author: string,
  rating: number,
  comment: string,
  age: number,
  likes: number,
  dislikes: number,
): Review {
  return { id, author, rating, comment, createdAt: ago(age), likes, dislikes, myReaction: null };
}

// ── orders ─────────────────────────────────────────────────────────────────

const DETAILS: Record<ServiceType, OrderDetails['details']> = {
  international: [
    { field: 'route', value: 'Shenzhen, China → Alexandria, Egypt' },
    { field: 'mode', value: 'Sea · LCL' },
    { field: 'goods', value: 'قطع غيار دراجات نارية' },
    { field: 'weight', value: '480 kg · 2.1 m³' },
    { field: 'customs', value: 'نعم، تخليص كامل' },
  ],
  domestic: [
    { field: 'route', value: 'القاهرة (مدينة نصر) → أسيوط' },
    { field: 'goods', value: 'أجهزة منزلية (٦ صناديق)' },
    { field: 'weight', value: '220 kg' },
    { field: 'vehicle', value: 'شاحنة متوسطة بصندوق' },
    { field: 'pickupDate', value: '2026-11-25' },
  ],
  china: [
    { field: 'sites', value: 'SHEIN, 1688' },
    { field: 'items', value: '14 items · 3 orders' },
    { field: 'service', value: 'Consolidation + shipping to Egypt' },
    { field: 'delivery', value: 'الجيزة، الدقي' },
  ],
};

const offer = (
  id: string,
  partnerNumber: number,
  totalCost: number,
  transitDays: number,
  status: Offer['status'] = 'pending',
): Offer => ({
  id,
  partnerNumber,
  totalCost,
  currency: 'EGP',
  transitDays,
  validUntil: ago(-5 * DAY),
  includes: transitDays > 10 ? ['freight', 'customs', 'insurance'] : ['freight', 'door_delivery'],
  notes: partnerNumber % 2 ? 'السعر شامل التأمين على الشحنة.' : 'Pickup within 24 hours.',
  status,
});

const STEPS_FOR: Record<OrderStatus, TimelineStep[]> = {
  under_review: ['submitted'],
  awaiting_offers: ['submitted', 'under_review'],
  offers_received: ['submitted', 'under_review', 'offers_received'],
  awaiting_approval: ['submitted', 'under_review', 'offers_received', 'selected'],
  in_progress: [
    'submitted',
    'under_review',
    'offers_received',
    'selected',
    'approved',
    'in_progress',
  ],
  completed: [
    'submitted',
    'under_review',
    'offers_received',
    'selected',
    'approved',
    'in_progress',
    'completed',
  ],
  cancelled: ['submitted', 'under_review'],
  rejected: ['submitted', 'under_review'],
};

function order(
  n: number,
  service: ServiceType,
  status: OrderStatus,
  age: number,
  offers: Offer[] = [],
  extra: Partial<OrderDetails> = {},
): OrderDetails {
  const steps = STEPS_FOR[status];
  const createdAt = ago(age);
  return {
    id: `ord_${n}`,
    reference: `MG-R-2026-${String(n).padStart(6, '0')}`,
    service,
    status,
    createdAt,
    updatedAt: ago(Math.max(age - steps.length * 6 * HOUR, HOUR)),
    offersCount: offers.length,
    newOffers:
      status === 'offers_received' ? offers.filter((o) => o.status === 'pending').length : 0,
    details: DETAILS[service],
    offers,
    timeline: steps.map((step, i) => ({ step, at: ago(age - i * 6 * HOUR) })),
    cancelReason: null,
    ...extra,
  };
}

export const orders: OrderDetails[] = [
  order(118, 'international', 'offers_received', 2 * DAY, [
    offer('of_1', 1, 38500, 24),
    offer('of_2', 7, 41200, 18),
    offer('of_3', 12, 36900, 28),
  ]),
  order(117, 'china', 'offers_received', 3 * DAY, [
    offer('of_4', 3, 5400, 12),
    offer('of_5', 9, 4950, 15),
  ]),
  order(116, 'domestic', 'awaiting_offers', 6 * HOUR),
  order(115, 'domestic', 'awaiting_approval', 5 * DAY, [
    offer('of_6', 4, 2300, 2, 'selected'),
    offer('of_7', 11, 2650, 1),
  ]),
  order(114, 'international', 'in_progress', 12 * DAY, [offer('of_8', 2, 52000, 21, 'approved')]),
  order(113, 'china', 'completed', 30 * DAY, [offer('of_9', 5, 3800, 14, 'approved')]),
  order(112, 'international', 'completed', 48 * DAY, [offer('of_10', 1, 61000, 25, 'approved')]),
  order(111, 'domestic', 'cancelled', 52 * DAY, [], { cancelReason: 'تأجّل موعد النقل.' }),
  order(110, 'china', 'rejected', 70 * DAY),
];

// ── notifications ──────────────────────────────────────────────────────────

export const notifications: AppNotification[] = [
  notification('n1', 'new_offer', 'MG-R-2026-000118', 'ord_118', 2 * HOUR, false),
  notification('n2', 'new_offer', 'MG-R-2026-000117', 'ord_117', 7 * HOUR, false),
  notification('n3', 'question_reply', 'MG-R-2026-000115', 'ord_115', DAY, false),
  notification('n4', 'order_status', 'MG-R-2026-000114', 'ord_114', 2 * DAY, true),
  notification('n5', 'security', '', '', 3 * DAY, true),
  notification('n6', 'order_status', 'MG-R-2026-000113', 'ord_113', 9 * DAY, true),
  notification('n7', 'news', '', '', 14 * DAY, true),
];

function notification(
  id: string,
  event: AppNotification['event'],
  reference: string,
  orderId: string,
  age: number,
  read: boolean,
): AppNotification {
  const link =
    event === 'security' ? '/app/account/security' : orderId ? `/app/orders/${orderId}` : '/app';
  return { id, event, params: { reference }, createdAt: ago(age), read, link };
}

export const notificationPrefs: NotificationPrefs = {
  new_offer: { inApp: true, email: true },
  order_status: { inApp: true, email: true },
  question_reply: { inApp: true, email: false },
  security: { inApp: true, email: true },
  news: { inApp: false, email: false },
};

// ── account ────────────────────────────────────────────────────────────────

export const sessions: DeviceSession[] = [
  {
    id: 's1',
    device: 'Windows PC',
    browser: 'Chrome 131',
    location: 'Cairo, EG',
    lastActive: ago(0),
    current: true,
  },
  {
    id: 's2',
    device: 'iPhone 15',
    browser: 'Safari',
    location: 'Giza, EG',
    lastActive: ago(5 * HOUR),
    current: false,
  },
  {
    id: 's3',
    device: 'Samsung Galaxy A54',
    browser: 'Chrome Mobile',
    location: 'Alexandria, EG',
    lastActive: ago(4 * DAY),
    current: false,
  },
];

export const loginActivity: LoginActivity[] = [
  {
    id: 'l1',
    at: ago(10 * 60 * 1000),
    device: 'Windows PC · Chrome',
    location: 'Cairo, EG',
    success: true,
  },
  { id: 'l2', at: ago(5 * HOUR), device: 'iPhone · Safari', location: 'Giza, EG', success: true },
  {
    id: 'l3',
    at: ago(DAY),
    device: 'Unknown device · Firefox',
    location: 'Tanta, EG',
    success: false,
  },
  {
    id: 'l4',
    at: ago(4 * DAY),
    device: 'Android · Chrome',
    location: 'Alexandria, EG',
    success: true,
  },
];

export const addresses: Address[] = [
  {
    id: 'ad_1',
    label: 'المنزل',
    governorate: 'cairo',
    city: 'مدينة نصر',
    street: '١٢ شارع عباس العقاد',
    landmark: 'بجوار سيتي ستارز',
    phone: '+201012345678',
    isDefault: true,
  },
  {
    id: 'ad_2',
    label: 'المستودع',
    governorate: 'giza',
    city: '6th of October',
    street: 'Industrial Zone 3, Block 14',
    landmark: '',
    phone: '+201112345678',
    isDefault: false,
  },
];

export const balanceHistory: BalanceEntry[] = [
  {
    id: 'b1',
    at: ago(2 * DAY),
    orderReference: 'MG-R-2026-000118',
    type: 'request',
    before: 4,
    after: 3,
    reason: 'new_request',
  },
  {
    id: 'b2',
    at: ago(6 * DAY),
    orderReference: 'MG-R-2026-000111',
    type: 'refund',
    before: 3,
    after: 4,
    reason: 'cancelled_before_offers',
  },
  {
    id: 'b3',
    at: ago(7 * DAY),
    orderReference: 'MG-R-2026-000111',
    type: 'request',
    before: 4,
    after: 3,
    reason: 'new_request',
  },
  {
    id: 'b4',
    at: ago(60 * DAY),
    orderReference: null,
    type: 'bonus',
    before: 0,
    after: 5,
    reason: 'welcome',
  },
];

// ── support ────────────────────────────────────────────────────────────────

export const tickets: Ticket[] = [
  {
    id: 'tk_21',
    reference: 'TK-000021',
    subject: 'استفسار عن موعد وصول الشحنة',
    category: 'order',
    status: 'in_progress',
    orderReference: 'MG-R-2026-000114',
    updatedAt: ago(5 * HOUR),
    messages: [
      {
        id: 'm1',
        from: 'customer',
        body: 'تأخرت الشحنة يومين عن الموعد، هل يمكنني معرفة السبب؟',
        at: ago(DAY),
        attachment: null,
      },
      {
        id: 'm2',
        from: 'support',
        body: 'مرحبًا منى، تواصلنا مع الشركة، والشحنة في الجمارك وسيتم الإفراج عنها خلال ٢٤ ساعة.',
        at: ago(5 * HOUR),
        attachment: null,
      },
    ],
  },
  {
    id: 'tk_17',
    reference: 'TK-000017',
    subject: 'Invoice copy for my last order',
    category: 'payment',
    status: 'resolved',
    orderReference: 'MG-R-2026-000112',
    updatedAt: ago(20 * DAY),
    messages: [
      {
        id: 'm3',
        from: 'customer',
        body: 'Could you send me the invoice for this order?',
        at: ago(22 * DAY),
        attachment: null,
      },
      {
        id: 'm4',
        from: 'support',
        body: 'Sure, we emailed it to you. Anything else?',
        at: ago(20 * DAY),
        attachment: { name: 'invoice-112.pdf', size: 184_000 },
      },
    ],
  },
];
