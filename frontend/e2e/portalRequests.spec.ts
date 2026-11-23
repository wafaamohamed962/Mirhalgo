import { expect, test, type Locator, type Page } from '@playwright/test';
import arApp from '../src/i18n/ar.json' with { type: 'json' };
import enApp from '../src/i18n/en.json' with { type: 'json' };
import arPortal from '../src/i18n/portal/ar.json' with { type: 'json' };
import enPortal from '../src/i18n/portal/en.json' with { type: 'json' };
import {
  mockPortalApi,
  mockSupabase,
  PROFILE_ROW,
  seedCustomerSession,
  setLanguage,
} from './mocks';

/*
 * New Request forms (MW_003 B5) on the portal build (MSW on, the order API mocked like the real
 * one by mockPortalApi). Every form is filled to the end and submitted in Arabic and English, on
 * desktop and at 360 px, with no horizontal overflow on any step. Labels come from the i18n
 * files, so the same steps run in both languages.
 */

type Lang = 'ar' | 'en';
type Dict = Record<string, unknown>;
const DICTS: Record<Lang, Dict[]> = { ar: [arPortal, arApp], en: [enPortal, enApp] };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function translator(lang: Lang) {
  const tr = (key: string, vars: Record<string, string | number> = {}) => {
    for (const dict of DICTS[lang]) {
      const value = key.split('.').reduce<unknown>((node, k) => (node as Dict)?.[k], dict);
      if (typeof value === 'string')
        return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
          typeof vars[name] === 'number'
            ? (vars[name] as number).toLocaleString(lang)
            : String(vars[name]),
        );
    }
    throw new Error(`missing i18n key ${key}`);
  };
  const field = (key: string) => tr(`portal.request.fields.${key}`);
  const option = (list: string, value: string) => tr(`portal.request.options.${list}.${value}`);
  return { tr, field, option };
}

/** Helpers bound to one page and language. */
function formDriver(page: Page, lang: Lang) {
  const { tr, field, option } = translator(lang);
  const main = page.getByRole('main');
  const startsWith = (text: string) => new RegExp(`^${escape(text)}`);

  const choose = async (input: Locator) => {
    await input.locator('xpath=ancestor::label[1]').click();
    await expect(input).toBeChecked();
  };

  const noOverflow = async (where: string) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${lang} ${where}`).toBeLessThanOrEqual(1);
  };

  return {
    tr,
    field,
    option,
    main,
    noOverflow,
    async stepIs(n: number, total: number, step: string) {
      const name = tr(`portal.request.steps.${step}`);
      await expect(
        main.getByText(tr('portal.request.stepOf', { current: n, total, name })),
      ).toBeVisible();
      await noOverflow(step);
    },
    next: () => main.getByRole('button', { name: startsWith(tr('portal.request.next')) }).click(),
    /** Radios are visually hidden inside their card / chip label: click what the user sees. */
    radio: (list: string, value: string) =>
      choose(main.getByRole('radio', { name: startsWith(option(list, value)) })),
    choose,
    input: (key: string) => main.getByLabel(startsWith(field(key))).first(),
    async pick(key: string, name: string) {
      const box = main.getByRole('combobox', { name: startsWith(field(key)) });
      await box.click();
      await box.fill(name);
      await page
        .getByRole('option', { name: new RegExp(`^${escape(name)}( ?[A-Z]{3,5})?$`) })
        .click();
    },
    async submit() {
      await main
        .getByRole('checkbox', { name: startsWith(tr('portal.request.confirmAccuracy')) })
        .check();
      await main.getByRole('button', { name: startsWith(tr('portal.request.submit')) }).click();
      await expect(
        main.getByRole('heading', { name: tr('portal.request.success.title') }),
      ).toBeVisible();
      await noOverflow('success');
    },
  };
}

const pdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7 test'),
});

/** Reference names in the fixtures (test/referenceFixtures.ts). */
const NAMES = {
  ar: {
    CN: 'الصين',
    EG: 'مصر',
    SA: 'المملكة العربية السعودية',
    shanghai: 'شنغهاي',
    alexandria: 'الإسكندرية',
    cairo: 'القاهرة',
    jeddah: 'جدة',
    hc40: 'حاوية ٤٠ قدمًا عالية (HC)',
  },
  en: {
    CN: 'China',
    EG: 'Egypt',
    SA: 'Saudi Arabia',
    shanghai: 'Shanghai',
    alexandria: 'Alexandria',
    cairo: 'Cairo',
    jeddah: 'Jeddah',
    hc40: "40' High Cube",
  },
};

for (const lang of ['ar', 'en'] as const) {
  test.describe(`New Request forms (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await setLanguage(page, lang);
      await seedCustomerSession(page);
      await mockSupabase(page);
    });

    test('international · sea FCL · customs · hazardous with MSDS · invoice', async ({ page }) => {
      const api = await mockPortalApi(page, { drafts: false });
      const f = formDriver(page, lang);
      const n = NAMES[lang];
      await page.goto('/app/new-request/international');
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

      await f.stepIs(1, 6, 'customer');
      await expect(f.input('fullName')).toHaveValue(
        `${PROFILE_ROW.first_name} ${PROFILE_ROW.last_name}`,
      );
      await f.radio('clientType', 'company');
      await f.input('businessName_company').fill('Acme Trading');
      await f.next();

      await f.stepIs(2, 6, 'operation');
      await f.radio('operationType', 'import');
      await f.radio('serviceScope', 'shipping_customs');
      await f.radio('mode', 'sea');
      await f.next();

      await f.stepIs(3, 6, 'route');
      await f.radio('seaType', 'fcl');
      await f.pick('originCountry', n.CN);
      await f.pick('origin_port', n.shanghai);
      await f.pick('destinationCountry', n.EG);
      await f.pick('destination_port', n.alexandria);
      await f.next();
      await expect(f.main.getByText(f.tr('validation.required')).first()).toBeVisible();
      await f.radio('routeSide', 'destination');
      await f.next();

      await f.stepIs(4, 6, 'cargo');
      await f.pick('containerType', n.hc40);
      await f.input('count').fill('2');
      await f.input('groupDescription').fill(lang === 'ar' ? 'أثاث منزلي' : 'Furniture');
      await f.choose(f.main.getByRole('radio', { name: f.tr('portal.request.yes'), exact: true }));
      await f.input('readyDate').fill('2099-01-15');
      await f.next(); // the MSDS is required for hazardous goods
      await expect(f.main.getByText(f.tr('validation.required')).first()).toBeVisible();
      await f.input('msds').setInputFiles(pdf('msds.pdf'));
      await f.input('commercialInvoice').setInputFiles(pdf('invoice.pdf'));
      await expect(f.main.getByText('invoice.pdf')).toBeVisible();
      await expect(f.main.getByText('msds.pdf')).toBeVisible();
      await f.noOverflow('cargo with files');
      await f.next();

      await f.stepIs(5, 6, 'services');
      await f.radio('executionDocuments', 'client');
      await f.next();

      await f.stepIs(6, 6, 'review');
      await expect(f.main.getByText('invoice.pdf')).toBeVisible();
      await expect(f.main.getByText(n.shanghai).first()).toBeVisible();
      await f.submit();
      await expect(f.main.getByText('MG1001')).toBeVisible();

      expect(api.uploads.map((u) => [u.purpose, u.name])).toEqual([
        ['msds', 'msds.pdf'],
        ['invoice', 'invoice.pdf'],
      ]);
      expect(api.orders).toHaveLength(1);
      const [{ key, body }] = api.orders as [(typeof api.orders)[number]];
      expect(key).toMatch(/^[0-9a-f-]{36}$/);
      expect(body).toMatchObject({
        service: 'international',
        shipment: {
          mode: 'sea',
          seaType: 'fcl',
          clearanceLocation: 'destination',
          origin: { country: 'CN', port: { id: 'CN-SHANGHAI' } },
          destination: { country: 'EG', port: { id: 'EG-ALEXANDRIA' } },
          cargo: { kind: 'containers', hazardous: true, msdsUploadId: api.uploads[0]!.id },
        },
        shipmentDocuments: { commercialInvoice: [api.uploads[1]!.id] },
      });
    });

    test('domestic · container transport · draft autosaved', async ({ page }) => {
      const api = await mockPortalApi(page, { drafts: false });
      const f = formDriver(page, lang);
      const n = NAMES[lang];
      await page.goto('/app/new-request/domestic');

      await f.stepIs(1, 6, 'customer');
      await f.radio('clientType', 'individual');
      await f.next();
      await f.stepIs(2, 6, 'operation');
      await f.next();

      await f.stepIs(3, 6, 'route');
      await f.radio('landType', 'container');
      await f.pick('loadingRegion', n.cairo);
      await f.pick('dischargePort', n.alexandria);
      await f.next();

      await f.stepIs(4, 6, 'cargo');
      await f.pick('containerType', n.hc40);
      await f.input('groupDescription').fill(lang === 'ar' ? 'قطع غيار' : 'Spare parts');
      await f.choose(f.main.getByRole('radio', { name: f.tr('portal.request.no'), exact: true }));
      await f.input('readyDate').fill('2099-02-01');
      // the draft reaches the server while the form is filled (debounced autosave)
      await expect.poll(() => api.savedDrafts.domestic).toBeTruthy();
      await f.next();

      await f.stepIs(5, 6, 'services');
      await f.next();
      await f.stepIs(6, 6, 'review');
      await f.submit();
      expect(api.orders[0]?.body).toMatchObject({
        service: 'domestic',
        shipment: {
          landType: 'container',
          loadingRegion: 'EG-C',
          dischargePort: 'EG-ALEXANDRIA',
          cargo: { kind: 'containers', hazardous: false },
        },
      });
      expect(api.savedDrafts.domestic).toBeUndefined(); // no autosave after the submit
    });

    test('china · Chinese sites · manual product · delivery to Saudi Arabia', async ({ page }) => {
      const api = await mockPortalApi(page, { drafts: false });
      const f = formDriver(page, lang);
      const n = NAMES[lang];
      await page.goto('/app/new-request/china');

      await f.stepIs(1, 4, 'customer');
      await f.radio('clientType', 'trader');
      await f.next();

      await f.stepIs(2, 4, 'order');
      await f.radio('source', 'chinese_sites');
      await f.radio('chineseSite', 'alibaba');
      await f.radio('addMethod', 'manual');
      await f.input('productName').fill(lang === 'ar' ? 'مصباح مكتب' : 'Desk lamp');
      await f.input('quantity').fill('3');
      await f.next();

      await f.stepIs(3, 4, 'delivery');
      await f.radio('mode', 'air');
      await f.pick('deliveryCountry', n.SA);
      await f.pick('city', n.jeddah);
      await f
        .input('deliveryAddress')
        .fill(lang === 'ar' ? 'حي الروضة، شارع ٥' : 'Al Rawdah, street 5');
      await f.next();

      await f.stepIs(4, 4, 'review');
      await f.submit();
      expect(api.orders[0]?.body).toMatchObject({
        service: 'china',
        order: {
          source: 'chinese_sites',
          chineseSite: 'alibaba',
          addMethod: 'manual',
          products: [{ quantity: '3' }],
        },
        delivery: { shippingMethod: 'air', country: { id: 'SA' }, city: { id: 'SA-JEDDAH' } },
      });
    });
  });
}
