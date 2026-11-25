# MW_004 plan: Company portal (frontend) + demo company login

Spec: `docs/MW_004.md` (copied from the developer's spec folder on 2026-11-24). It is the single
source of truth. The `Company_vieww.html` demo it mentions is **not available**: the Team Lead
confirmed every feature is described in the spec. Where the spec is silent, this plan proposes a
default (§3, §6) that reuses the customer portal.

Branch: `feature/mw-004` from `main` (MW_001–MW_003 merged).
Status: **approved by the developer on 2026-11-24** (answers below). Work phase by phase, with a
report after A1, A2 and A3.

### Answers (2026-11-24, by the developer)

- **Q8 category colours:** approved. Added to `tokens.css` only, with the contrast check.
- **Q3 demo phone / legal numbers:** approved: `+201000000001`, CR `9990000001`, tax
  `999000001`.
- **Q2 email domain:** keep `demo.company@mirhalgo.com` for now (domain being confirmed with
  the Team Lead).
- **Q11 suspension toggle:** approved, **only** inside the demo tools section next to "Reset
  demo data". Nowhere else.
- **Q16 money format:** follow the spec in the company portal, through **one shared formatter
  with an option** (no duplicate). Whether the whole site should match is pending with the
  Team Lead.
- **Q4 company identity:** approved: name / email mocked; role and `companyStatus` from the
  real backend.
- **Back button:** approved on the 5 sections, not Overview; customer portal unchanged.
- The seed script is **not run** against the database until the developer confirms.
- Every other question uses its proposed default.

---

## 1. Checklist (everything the spec describes)

### Part A: role-based login + demo account

- [ ] A1.1 One `/login` for companies and customers (email or phone + password). No company login.
- [ ] A1.2 After login, redirect by role and company status:
  - verified customer → `/app/new-request`;
  - company `approved` → `/company/overview`;
  - company `pending_review` / `changes_requested` / `rejected` → `/company/application-status`;
  - unverified email (any role) → `/verify-email`.
- [ ] A1.3 Guards: `/app/*` customers only, `/company/*` companies only.
- [ ] A1.4 Opening the other portal's URL → redirect to your own portal, never an error page.
- [ ] A1.5 Login response (or `GET /api/me`) returns `role` and `companyStatus`. The frontend
      never guesses the role from the email.
- [ ] A1.6 Logout in both portals, clears the session.
- [ ] A2.1 One demo company account, created by a **seed script** (not by hand).
- [ ] A2.2 Role `company`, email verified, application `approved`, complete company profile.
- [ ] A2.3 Data: legal name "أليكس إكسبريس للشحن الدولي واللوجستيات", alias "الناقل الذهبي",
      activity international shipping & customs.
- [ ] A2.4 Email `demo.company@mirhalgo.com` (or an agreed address).
- [ ] A2.5 Password from `DEMO_COMPANY_PASSWORD`. Never committed, never printed.
- [ ] A2.6 Seeded in development / staging only. Production only with Team Lead approval.
- [ ] A2.7 All Part B mock data belongs to this account.

### B1. Mock data layer

- [ ] TanStack Query + MSW, realistic fixtures, ~400 ms latency.
- [ ] Fixtures: ≈6 companies, ≈28 orders, all offers (ours + competitors'), client inquiries.
- [ ] Formal Arabic in every fixture.
- [ ] Privacy **in the mock handler**, not the UI:
  - company order responses never include client contact fields (name, phone, WhatsApp);
  - competitor offers anonymized (no company id or name);
  - offers of companies with "hide my offers" are not returned; only their count is.
- [ ] Mutations (submit / edit offer, reply, settings) update the mock state and persist in
      `localStorage` **per account** (survive a refresh).
- [ ] Settings → "Reset demo data", dev / staging only.

### B2. Layout

- [ ] Same structure as the customer portal, branded as the company portal.
- [ ] Sidebar: logo + "MirhalGo — Partner Companies Portal".
- [ ] 6 items:
  - Overview;
  - Available requests (badge: assigned requests with no offer from us);
  - Our submitted offers (badge: offers under review);
  - Competitor offers;
  - Client inquiries (badge: awaiting reply);
  - Account settings.
- [ ] Sidebar bottom: company initial avatar, alias (or legal name), email, **Logout**.
- [ ] Top bar: "مرحبًا بكم، {company name}", account status badge ("حساب مقبول"), AR / EN switch.
- [ ] Every section has **Back**: previous section, or Overview if there is none (router history).
- [ ] Responsive: collapsible sidebar on tablet, drawer on mobile.
- [ ] Category system (every list): icon + colour per category, mapped to tokens:
  - sea freight & customs: ship, blue;
  - international land: fast truck, amber;
  - domestic land: truck, lighter amber;
  - air: plane, sky;
  - SHEIN: shopping bag, red / gold;
  - Chinese sites: globe, red / gold.
- [ ] List rows: coloured side stripe, icon tile, service chip.
- [ ] "جديد" (New) badge on requests, offers and inquiries not opened yet. It disappears once the
      item is opened. Opened ids stored per account (mock: `localStorage`).

### B3. Overview `/company/overview`

- [ ] 6 KPI cards: offers submitted, accepted, rejected, completed orders, average response time
      (hours), on-time delivery rate (%).
- [ ] Requests awaiting our offer: max 8, with category icon, order id + New, service, **Submit
      offer**, and "View all".
- [ ] Our latest offers: 5 most recent (order, total, status) + "View all".
- [ ] Client inquiries awaiting reply + "View all".
- [ ] Recent account activity (newest first).
- [ ] An empty state for every block.

### B4. Available requests `/company/requests`

- [ ] Scope note (assigned by the administration by approved activity).
- [ ] Only orders that are **published** and **assigned to this company**.
- [ ] Search by order id or service type; newest first.
- [ ] Columns:
  - order id (category icon + New);
  - date;
  - service chip;
  - offers on this order: the total; when > 0 it is clickable and opens the comparison modal;
    "(you have N)" when we have offers;
  - status;
  - actions: **Details**, and **Submit offer** / **Submit additional offer**.
- [ ] Order details modal:
  - privacy notice (contact data hidden; communication through the platform after approval);
  - every visible form section and field; empty values → "—";
  - a **Submit offer** button.
- [ ] Modal open state in the URL (`?order=MG1029`).

### B5. Submit / edit offer modal

- [ ] The form follows the order's category. Template fields optional, **total cost required**.
- [ ] Templates:
  - **Sea & customs**: ocean freight, THC, B/L fee, telex release, transit time, free time,
    departure date. Total: dual currency.
  - **International land**: vehicle type, transport cost, transit time, loading date, border
    crossing, notes. Total: dual currency.
  - **Domestic land**: vehicle type, transport cost, transit time, loading date, notes. Total:
    EGP only.
  - **Air**: air freight cost, airline, flight date, transit time, extra charges. Total: dual
    currency.
  - **China** (SHEIN + Chinese sites): weight cost, product purchase cost, shipping duration.
    Total: EGP only.
- [ ] Dual currency: foreign (USD or EUR) and/or EGP; at least one, both allowed.
- [ ] EGP only: one amount, required.
- [ ] Amounts positive only; Arabic digits → Western.
- [ ] Display "1,000 دولار + 38,000 جنيه" / "5,200 جنيه".
- [ ] More than one offer per order allowed.
- [ ] Edit only while **under review**. Edit pre-fills everything; the offer stays under review.
- [ ] Offer submission suspended by the admin → blocked: toast + disabled state with an
      explanation.
- [ ] Unique offer ids (not count-based).
- [ ] Real current date.
- [ ] After submit / edit: success toast, activity log entry, every affected list, badge and KPI
      updated.

### B6. Our submitted offers `/company/offers`

- [ ] Note: edit only while under review; several offers per request allowed.
- [ ] Stats bar: total, under review, accepted, rejected.
- [ ] Status filter (all / under review / accepted / rejected) + search by offer id or order id.
- [ ] Grouped by order, groups sorted by their latest offer. The group header shows order id,
      service, number of our offers and an **Order details** link.
- [ ] Offer card: id, New, status badge, date, template name, total; rejected → rejection reason;
      stripe colour follows the status.
- [ ] Actions: **Edit offer** (under review only), **Compare prices** (order has > 1 offer).
- [ ] Opening a card removes its New badge.

### B7. Competitor offers `/company/competitors`

- [ ] Intro: names hidden; companies that hide their offers are not shown.
- [ ] Orders where we are assigned or have offered **and** at least one other company offered.
- [ ] Columns: order id, service, our offer(s) (totals or "we have not submitted an offer yet"),
      number of visible competitor offers, **Compare**.
- [ ] Comparison modal:
  - our offers (id, status, template, date, total);
  - each visible competitor as "Competitor company #N" (status, template, date, total);
  - "+ N companies chose to hide their offers";
  - never a competitor's name, id or alias.

### B8. Client inquiries `/company/inquiries`

- [ ] Intro: each inquiry is linked to its order and our offer.
- [ ] Filter: all / awaiting reply / replied. Search by order id or inquiry id. Newest first.
- [ ] Card: id, New, status, order id + category icon, date, question preview, open button.
- [ ] Modal:
  - order summary: id, service, the first 3 visible fields, a link to the full details, no
    contact data;
  - our offer(s) on the order: id, status, total;
  - the client's question;
  - reply textarea (required) → "Send reply" (reaches the client through the administration),
    status → Replied;
  - after the reply: shown **read-only** with its date (the demo allowed overwriting).

### B9. Account settings `/company/settings`

- [ ] Company data: legal name (read-only), activity type (read-only), contact email, contact
      phone (country code) → **Save** (validated).
- [ ] Offer privacy toggle "hide our offers from competitor companies" + explanation (always
      visible to the administration and the client); toast + activity log entry.
- [ ] Offer submission status: read-only badge (allowed / suspended) + "contact support".
- [ ] Password: **current**, new, confirm; the sign-up password policy; mocked.
- [ ] Demo tools: "Reset demo data" (dev / staging only).

### B10. Shared UI

- [ ] Toasts success / error / info; confirmation modal; loading buttons that block double
      clicks.
- [ ] Modals: scroll lock, Esc, click outside, focus trap.
- [ ] Every list: loading skeleton, empty, error.
- [ ] Never raw HTML from user content; no `dangerouslySetInnerHTML`.

### B11. Routes

- [ ] `/company` → `/company/overview`, plus `overview`, `requests` (modals in the URL),
      `offers`, `competitors`, `inquiries`, `settings`, `application-status`.

### B12. Mock API (future backend shape), typed in `shared`

- [ ] `GET /api/company/me`, `GET /api/company/dashboard`.
- [ ] `GET /api/company/requests`, `GET /api/company/requests/:id`,
      `POST /api/company/requests/:id/offers`.
- [ ] `GET /api/company/offers`, `PATCH /api/company/offers/:id`.
- [ ] `GET /api/company/competitors`, `GET /api/company/competitors/:orderId`.
- [ ] `GET /api/company/inquiries`, `POST /api/company/inquiries/:id/reply`.
- [ ] `PATCH /api/company/settings/contact`, `PATCH /api/company/settings/privacy`,
      `POST /api/company/settings/password`.

### Acceptance + deliverables

- [ ] Every acceptance criterion of the spec (login landing, cross-portal guards, seed + env
      password, all sections / modals, offer rules, privacy in the mock API, persistence + reset,
      logout, responsive, AR / EN, formal Arabic).
- [ ] PR(s), README (incl. running the seed), the seed script, a deployed preview, a demo video
      (both logins from the same page, every company section, desktop + mobile, AR + EN).
- Out of scope: real company-portal backend, admin assignment, notifications / emails to
  companies, payments.

---

## 2. Phases

Each phase ends with build + lint + tests passing and a commit when the developer says so.

### Part A (real backend)

**A1. `role` + `companyStatus` from the API** (shared + backend)

- Shared: `CompanyStatus` (= `ApplicationStatus`), `MeResponse`
  `{ id, role, emailVerified, companyStatus: CompanyStatus | null }`. `LoginResult` gains
  `companyStatus`.
- Backend: `login()` reads the company's application status (one indexed select) for role
  `company`. New `GET /api/me` for any authenticated role: a new `requireAuthenticated`
  middleware (same `getUser(token)` check as decision 26, no role filter), plus
  `services/me.ts → getMe()`. `/api/me/summary` stays customer only.
- Tests: login per role / status, `GET /api/me` 401 / customer / company / revoked token.
- Delivers: the frontend can route without guessing.

**A2. Routing by role and status** (frontend)

- `AuthProvider`: after the session loads, a `useMe` query (TanStack Query) gives
  `companyStatus`. It is seeded from the login response, so there is no second wait right after
  login. `loading` stays true until it is known for a company.
- `homePath(role, companyStatus)`:
  - customer → `/app/new-request`;
  - company `approved` → `/company/overview`;
  - other company statuses → `/company/application-status`.
- Guards:
  - `ProtectedRoute allow={['company']}` + a new `CompanyStatusRoute`: approved → the portal
    pages; not approved → the status page only, and the other way round;
  - wrong role → own home;
  - the old `/application-status` → `<Navigate to="/company/application-status" replace>`.
- `ApplicationStatusPage` moves to `features/companyPortal/pages/` at
  `/company/application-status`. It stays a `SimpleLayout` page with Logout + Back.
- Login / verify-email / `HomeRedirect` / `GuestRoute` use the new `homePath`. `backFallback`
  gets the company status (§5 item 2).
- An empty `/company` layout route for now (filled in B3).
- Tests: guards (every role × status × portal), `backFallback`. E2E: login as a customer and
  as an approved / pending company from the same `/login`; cross-portal URLs redirect; logout
  from both.

**A3. Demo company seed script** (backend, **written, not run**)

- `backend/src/scripts/seedDemoCompany.ts` → `npm run seed:demo-company -w backend`.
- Env: `DEMO_COMPANY_PASSWORD` (required, checked against the shared password policy, never
  logged), `DEMO_COMPANY_EMAIL` (default `demo.company@mirhalgo.com`). Both are added **empty**
  to `backend/.env.example`.
- Safety:
  - refuses when `NODE_ENV=production` unless `--allow-production`;
  - always prints the target Supabase project ref (not a secret) and needs `--yes` before
    writing.
- Steps (same building blocks as `registerCompany`, so the DB rules stay in one place):
  1. Admin API: create the user (`email_confirm: true`, `app_metadata.role = company`).
  2. Upload placeholder PDFs for the 2 required documents (generated in memory).
  3. Call `create_company_registration` (EG, Alexandria, international shipping + customs).
  4. `transition_application_status`: `pending_verification → pending_review → approved`
     (actor `system`, note "demo seed").
  5. Mark the profile verified.
  - On failure: roll back the files and the user, like `registerCompany`.
- Idempotent:
  - the account already exists as the demo company → it makes sure the account is approved;
    the password changes only with `--reset-password`;
  - the email belongs to another account → it stops and changes nothing.
- `--remove` deletes the demo account, its rows and its files (it frees the unique email /
  phone / legal numbers).
- No emails are sent. Logs show a masked email only.
- Tests: unit tests over the in-memory Supabase fake (create, idempotent rerun, wrong role
  refused, production refused, password never in the output).
- README: how and where to run it.

### Part B (frontend only, MSW)

**B1. Shared contract**: `shared/src/companyPortal.ts` + `schemas/companyPortal.ts`

- Types for every B12 response:
  - `CompanyMe`, `CompanyDashboard` (KPIs, activity), `CompanyRequest` (list row),
    `CompanyRequestDetails` (the order **without contact fields**, as a type with those keys
    omitted);
  - `CompanyOffer`, `CompetitorOffer` (`{ label: number, status, template, date, total }`, no
    id or name), `CompetitorComparison` (`{ ours, competitors, hiddenCount }`);
  - `CompanyInquiry`, settings bodies.
- `SERVICE_CATEGORIES` (6) + `categoryOf(order)`: sea / international land / air from the
  international mode, domestic → domestic land, China source SHEIN / other sites.
- `OFFER_TEMPLATES` (5) + `templateOf(category)`. One Zod schema per template with a
  discriminated union on `template`:
  - optional fields;
  - `total` = dual (`{ foreign?: { amount, currency: USD | EUR }, egp? }`, at least one) or
    EGP only (required);
  - positive amounts; Arabic / Persian digits and "٫" accepted through the existing
    order-number preprocessing.
- Contact / privacy / password / reply schemas. The password schema reuses `password.ts`.
- Tests in `shared/test/companyPortal.test.ts`.

**B2. MSW fixtures + handlers** (`frontend/src/mocks/company/`)

- `fixtures.ts`, in formal Arabic + English:
  - 6 companies: ours + 5 fictional competitors, 2 of them with "hide offers";
  - 28 orders over the 6 categories: valid shared `Order` objects, so the order details reuse
    the MW_003 summary;
  - offers (ours + competitors'), ≈10 inquiries (some replied), the activity log, KPI inputs.
- Dates are relative to the first load (so the demo never looks stale) and then persisted.
- `db.ts`: state per account. `localStorage` key `mirhalgo.companyDemo.v1.<userId>` (user id
  from the Bearer token's `sub`, mock only). A fixture version bump resets it. `reset()` for the
  demo tool.
- `handlers.ts`: the 14 endpoints at 400 ms latency.
  - Privacy filtering in the handler: contact fields stripped, competitor offers mapped to
    `CompetitorOffer`, hidden companies counted only.
  - Server-side rules: edit only `under_review`; submission suspended → 403
    `OFFER_SUBMISSION_SUSPENDED`; a reply only once → 409 `INQUIRY_ALREADY_REPLIED`.
  - Unique offer ids from a persisted counter; the activity log is written by the mock.
- Registered next to the customer handlers in `browser.ts`.
- Tests (node MSW server): every privacy rule asserted on the **raw responses**, persistence,
  reset, every mutation rule.

**B3. Company portal shell**

- Refactor: the parts of `PortalLayout` that both portals need move into a shared
  `components/portal/` shell: sidebar with collapse, top bar frame, mobile drawer, nav item
  with a badge. The customer layout keeps its look and its bottom nav (checked by its existing
  E2E).
- `features/companyPortal/layout/CompanyLayout`:
  - sidebar: brand subtitle, 6 items, 3 badges from the dashboard counts;
  - user block: initial avatar, alias, email, Logout;
  - top bar: welcome, status badge, `LanguageSwitch`;
  - drawer on mobile.
- `components/CategoryIcon` / `CategoryChip` / stripe classes (tokens, §6 Q8), `useSeen()` store
  for the New badges (per account, `localStorage`), `services/api/company.ts` (`companyApi.*`)
  - query hooks, and `i18n/company/{ar,en}.json` loaded as its own chunk.
- Back button on the sections (§5 item 3). Route `handle` titles as in the customer portal.

**B4. Overview**: 6 KPI cards, 4 blocks, empty / loading / error per block.

**B5. Available requests + order details + comparison modals**

- The table (a card list below `md`), search in the URL (`useQuerySearch`).
- Modals open from the URL: `?order=`, `?offer=new&order=`, `?compare=`.
- Order details: the MW_003 `summary.ts` sections with "—" for empty values, the privacy
  notice, attachments by name only.

**B6. Offer modal**: the 5 templates, the total-cost field (dual / EGP), create + edit,
the suspended state, the unsaved-changes guard, cache updates (lists, badges, KPIs, activity).

**B7. Our submitted offers**: stats bar, filter + search in the URL, groups, cards, edit /
compare, New handling.

**B8. Competitor offers**: list + the comparison modal (shared with B5).

**B9. Client inquiries**: filter + search in the URL, cards, the modal with a read-only reply
once sent.

**B10. Account settings + demo tools**: contact form (`PhoneInput`), privacy `Switch`,
submission badge, password form (mocked), demo tools (§6 Q11).

**B11. Hardening + docs**

- E2E (portal projects, desktop + 360 px, AR + EN):
  - both logins from the same page;
  - every section and modal;
  - privacy: no contact field or competitor name in any network response or in the DOM;
  - persistence after a reload; reset; no horizontal overflow; RTL sidebar side.
- The `arabicCopy` test covers the new copy and fixtures.
- README, `docs/MW_004-PR.md`, demo-video checklist. The deployed preview stays open (it needs
  the hosting accounts).

---

## 3. What I will reuse (no new styles, tokens only)

Assumptions for everything the spec does not describe visually:

- **Design system**: `tokens.css` only, existing Tailwind theme utilities, the UI kit
  (`Button` loading state, `Modal` (focus trap, Esc, backdrop, scroll lock),
  `ConfirmDialog`, `Badge`, `Card`, `Tabs`, `Skeleton`, `QueryState` / `EmptyState` /
  `ErrorState`, `Switch`, `Input`, `Textarea`, `Select`, `Combobox`, `PhoneInput`,
  `PasswordInput` + strength, `Avatar` (initials), `Toast`).
- **Layout**: the customer portal's sidebar / top bar / drawer pattern, widths, spacing and
  collapse behaviour.
- **Helpers**: `useUnsavedChangesGuard`, `useQueryParam` / `useQuerySearch`, `useDateFormat`,
  `useDebouncedValue`, `BackButton`, `hasChanges`, `apiRequest`, `useApiMutation` (toasts +
  cache sync), MW_003 `summary.ts` for the order details.
- **Copy**: every string in `i18n/company/{ar,en}.json`, simple formal MSA (decision 23 terms),
  masculine singular imperatives; key parity and the `arabicCopy` deny-list apply.
- **Status colours**: the existing `StatusBadge` tones (under review = blue, accepted = success,
  rejected = error).
- **Tables**: `relative overflow-x-auto` scrollers (MW_002 overflow fix); card lists below `md`.

## 4. New libraries

**None.** Everything is covered by what is installed: TanStack Query, MSW, RHF + Zod,
lucide-react, Sonner, react-router. Icons come from `lucide-react` (§6 Q9).

The only additions are **design tokens** in `tokens.css` for the category colours (§6 Q8).
This needs your OK.

## 5. Conflicts with earlier work and how I will handle them

1. **`homePath('company')` = `/application-status`** (MW_002 A5). It becomes status-aware (A2),
   with the old URL redirecting to `/company/application-status`. E2E and unit tests that use
   the old URL are updated.
2. **Navigation map + `backFallback`** (MW_003 navigation): company →
   `/application-status`. New map:
   - approved company: any `/company/*` → `/company/overview`;
   - non-approved company: → `/company/application-status` (from that page → `/`);
   - `Viewer` gains `companyStatus`. The customer and guest rules are unchanged.
3. **Back button placement.** MW_003 shows no Back on the customer portal's sidebar pages, but
   MW_004 asks for Back on **every company section**. The spec wins for the company portal
   only. Overview is the portal root, so it shows no Back (§6 Q10). The customer portal stays
   as it is.
4. **Customer `PortalLayout`.** Shared shell pieces are extracted (B3), not copied (DRY). The
   customer portal's look, bottom nav and tests stay the same. The company portal uses a
   **drawer on mobile** as the spec says (6 items do not fit a bottom nav).
5. **MSW `GET /me`.** The customer mocks still answer `GET /api/me` (identity became real with
   decision 22). That would shadow the new **real** `GET /api/me`, so I check what still uses
   it and remove or rename the mock route.
6. **Mock persistence.** The customer mocks are in memory (MW_002 B2, reset on reload). The
   company mocks persist per account (MW_004 B1). The two policies stay separate and are
   documented.
7. **Companies fixtures.** The customer directory's fictional companies and the company
   portal's 6 companies are separate data sets. Syncing them is out of scope.
8. **Order references.** The fixture orders use `MG10xx` (the spec's `MG1029`), the same format
   as real orders. Every `/api/company/*` path is mocked and does not overlap the passthrough
   `GET /orders/:ref`.
9. **Logout.** Decision 7 clears the company sign-up draft on logout. The company **demo data**
   is kept on logout (so the demo survives), and "Reset demo data" clears it.
10. **Status page.** It keeps the MW_002 behaviour (RLS read). An approved company opening it is
    sent to the overview.
11. **The spec says `packages/shared`.** The package is `shared/` since the 2026-11-22
    restructure.
12. **Settings.** Saving the contact email / phone does **not** change the login email or phone
    (mock contact data only). The password change is mocked even though a real reset exists.

## 6. Open questions / assumptions (proposed defaults)

Seed and environment:

- **Q1. One Supabase project.** `mirhalgo_v1` is the only project: dev, staging and (for now)
  production at once. Default:
  - the script is written and tested on the in-memory fake only; **it is not run until you
    confirm**;
  - it refuses `NODE_ENV=production` and needs `--yes` + shows the project ref;
  - `--remove` cleans up when a real production project exists.
- **Q2. Demo email.** `demo.company@mirhalgo.com`: is `mirhalgo.com` ours? The seed sends no
  email. A "forgot password" on this account would send to that domain. Default: use it as the
  spec says.
- **Q3. Unique values.** The phone is unique across all accounts and the legal numbers are
  unique per country, so the demo blocks those values for real companies. Default:
  `+201000000001`, CR `9990000001`, tax `999000001` (clearly fake), documented, freed by
  `--remove`. Overridable by env.
- **Q4. Company identity real or mock?** By analogy with decision 22, the logged-in company's
  name / email could come from its real row. Default: `GET /api/company/me` is **mocked** (the
  spec says frontend only), with the same values as the seed. Role + status are real
  (`GET /api/me`).

Data and rules:

- **Q5. Company-facing order statuses.** The spec lists "published" orders but has a Status
  column. Default: `open` (accepting offers), `awarded` (an offer accepted), `completed`,
  `cancelled`. All are listed; Submit offer only while `open`.
- **Q6. Template cost lines.** Default: each optional cost line = amount + currency
  (USD / EUR / EGP; default USD for sea / air / international land, EGP for domestic / China).
  The total is entered separately, not summed (currencies mix).
- **Q7. Field types.** Default:
  - transit time, free time, shipping duration: whole days 1–365;
  - departure / loading / flight dates: date ≥ today;
  - vehicle type: the existing `truck_types` reference list;
  - airline, border crossing: text ≤ 100;
  - extra charges, notes: text ≤ 500.
- **Q8. Category colours: new tokens.** Today there are blue-600, sky-400, warning (amber) and
  error (red). Missing: a lighter amber, a gold, and soft tile backgrounds. Default: add
  `--amber-100`, `--amber-300`, `--gold-500`, `--red-50`, `--sky-50` (+ theme mapping), each
  checked for AA contrast. SHEIN and Chinese sites share red / gold, as in the spec; the icon
  tells them apart.
- **Q9. Icons.** lucide has no "fast truck". Default: international land `Truck`, domestic land
  `Van`, sea `Ship`, air `Plane`, SHEIN `ShoppingBag`, Chinese sites `Globe`.
- **Q10. Back on Overview.** Default: not shown (it is the root; Back would go to itself).
  Shown on the other 5 sections. Without in-app history it goes to Overview.
- **Q11. Demo tools.** Default: shown when `import.meta.env.DEV` or `VITE_DEMO_TOOLS=true` (set
  on the preview), never in a production build without the flag. Also proposed: a demo-only
  "Simulate offer-submission suspension" toggle there, so the blocked state can be shown in the
  demo video. **Your call, this is beyond the spec.**
- **Q12. New badges.** Default: fixture items start unseen; an offer we submit is already seen;
  an offer whose status changed is New again. Opened ids live in
  `mirhalgo.companySeen.<userId>` (cleared by reset).
- **Q13. Offer / inquiry ids.** Default: `OF-` + 6 digits from a persisted counter (never
  reused after a reset of a single item); inquiries `IQ-` + 6 digits.
- **Q14. Competitor numbering.** Default: "Competitor company #N" numbered per order by the
  first offer time, stable across reloads. The same company gets the same number within one
  order only (no cross-order tracking).
- **Q15. Competitors list.** An order where the only other offers are hidden: default **listed**
  with 0 visible offers and the "+ N chose to hide" line.
- **Q16. Money display.** The spec shows Western digits in Arabic ("1,000 دولار"). Default:
  `latn` digits + the words دولار / يورو / جنيه in the company portal. Note: the customer portal
  shows Arabic-Indic digits; I propose to keep it as it is, unless you want both aligned.
- **Q17. KPIs.** Default:
  - submitted / accepted / rejected / completed: computed from the state;
  - average response time: hours from the order's assignment to our first offer;
  - on-time delivery rate: a fixture value (no delivery data in this task).
- **Q18. Modal URLs.** Default: opening pushes a history entry (the browser Back closes it), and
  closing goes back. A modal opened from a shared link closes with `replace`. Filters use
  `replace` (MW_003).
- **Q19. Reply.** Default: 10–2000 characters, plain text, rendered as text with line breaks.
- **Q20. Mobile.** Default: drawer from a top-bar menu button, no bottom nav (spec). Tablet
  (768–1279 px): collapsed sidebar by default, like the customer portal.
- **Q21. Without mocks.** With `VITE_USE_MOCKS=false` the company portal shows error states
  (there is no real API yet), the same as the customer portal. The preview runs with mocks on
  (decision 17).
- **Q22. Password (mocked).** Default: the shared password policy + confirmation; the current
  password "wrong" gives the error (the same demo code as the customer portal).
- **Q23. Order details attachments.** Default: file names only, no download (mock).

Still open from earlier tasks: deployed preview + Lighthouse; Team Lead confirmation of
decisions 1–29; demo lists for truck / container types and shipping lines; native-speaker
review of the Arabic copy.
