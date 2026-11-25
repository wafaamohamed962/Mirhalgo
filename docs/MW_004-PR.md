# MW_004 PR notes (draft, paste into the PR description)

Branch `feature/mw-004` from `main` (MW_001–MW_003). Spec: [`MW_004.md`](MW_004.md) · plan:
[`MW_004-plan.md`](MW_004-plan.md) (approved 2026-11-24, with the developer's answers). The
`Company_vieww.html` demo the spec mentions was not available: the Team Lead confirmed the spec
describes every feature.

## What changed

**Part A, role-based login + demo account (real backend)**

- **A1:** `POST /api/auth/login` returns `companyStatus` next to `role`. New `GET /api/me` (any
  role, token checked by Supabase on every request) returns `{ id, role, emailVerified,
companyStatus }`.
- **A2:** one `/login` for everyone, routed by role and status:
  - customer → `/app/new-request`;
  - approved company → `/company/overview`;
  - other company statuses → `/company/application-status` (moved from `/application-status`,
    which redirects).
  - Cross-portal URLs redirect to your own portal. The Back button's fallback knows the company
    status.
- **A3:** `npm run seed:demo-company -w backend`: the demo company "أليكس إكسبريس للشحن الدولي
  واللوجستيات" through the real registration code, then email verified + approved (actor
  `system`). Dry run by default, refuses production, password from `DEMO_COMPANY_PASSWORD`
  (never printed), `--reset-password`, `--remove`. **Seeded into `mirhalgo_v1` with the
  developer's OK: `MG-C-2026-000022`.** Remove it before launch (CLAUDE.md checklist).

**Part B, company portal (frontend only, MSW)**

| Phase | What                                                                                                                                                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1    | Shared contract (`shared/src/companyPortal.ts`, `schemas/companyPortal.ts`): categories, offer templates, statuses, every B12 response type, `toCompanyOrder` (privacy), the 5 offer schemas and the total rules, reply / contact / privacy schemas.                                     |
| B2    | MSW fixtures + the 14 endpoints (`src/mocks/company`): privacy enforced in the handlers, business rules, KPIs, state per account in `localStorage`, demo tools endpoints (mock only).                                                                                                    |
| B3    | Shared portal frame (`components/portal`, the customer layout now uses it too); company layout (sidebar, 3 badges, company block + Logout, top bar welcome + status + language, mobile drawer); category icons / colours (new tokens); "New" badges; one money formatter with an option. |
| B4    | Overview: 6 KPIs, requests awaiting our offer, latest offers, inquiries awaiting reply, activity; empty / error / suspended states.                                                                                                                                                      |
| B5    | Available requests: table (cards on phones), search in the URL, order details modal (privacy notice, every section, "—"), price comparison modal; modals open from the URL (`?order=`, `?compare=`).                                                                                     |
| B6    | Submit / edit offer modal: the template follows the category, total rules, Arabic digits, suspended state, unsaved-changes prompt, lists / badges / KPIs / log refresh.                                                                                                                  |
| B7    | Our submitted offers: stats, status filter + search in the URL, grouped by order, cards (open = template fields, "New" goes), Edit (under review only), Compare.                                                                                                                         |
| B8    | Competitor offers: one row per order with other offers, our totals, visible / hidden counts, Compare ("Competitor company #N").                                                                                                                                                          |
| B9    | Client inquiries: filter + search, modal (order summary without contact data, our offers, question), one reply that becomes read-only with its date.                                                                                                                                     |
| B10   | Account settings: company data (contact email / phone validated), offer privacy, submission status, password (current + new + confirm, mocked), demo tools (dev / staging only).                                                                                                         |
| B11   | E2E flows + privacy checks on every API response, no-raw-HTML check, README, these notes.                                                                                                                                                                                                |

## Assumptions / decisions (pending Team Lead confirmation)

Developer answers (2026-11-24):

- Category colour tokens: approved (contrast checked).
- Demo phone / legal numbers: `+201000000001`, `9990000001`, `999000001`.
- Demo email `demo.company@mirhalgo.com` (domain still being confirmed).
- Suspension switch only in the demo tools.
- Money in the spec format through one shared formatter (`useMoney({ format: 'plain' })`); the
  customer portal is unchanged.
- Company identity mocked; role + status real.
- Back on the 5 sections, not on Overview.
- **Editing an offer is blocked too while submission is suspended.**
- Seed into `mirhalgo_v1`, remove before launch.

Plan defaults used (plan §6):

- Q5 company-facing order statuses `open / awarded / completed / cancelled`; offers only on
  `open`.
- Q6 cost lines = amount + currency (USD by default for sea / air / international land, EGP for
  domestic / China), not summed into the total.
- Q7 days 1–365; dates today or later (Cairo); vehicle type from the `truck_types` list;
  airline / border crossing ≤ 100 characters; notes / extra charges ≤ 500.
- Q9 icons: lucide has no "fast truck": international land = Truck, domestic land = Van.
- Q12 "New": fixture items start unseen; our own new offer is seen; a status change makes an
  offer new again.
- Q13 ids `OF-` / `IQ-` + 6 digits from counters.
- Q14 "Competitor company #N" numbered per order by first offer.
- Q15 an order whose only other offers are hidden is still listed (0 visible + the hidden
  line).
- Q17 KPIs from the data; average response time = hours from assignment to our first offer;
  on-time rate = fixture value (94 %).
- Q18 modals in the URL: opening pushes (browser Back closes), closing goes back; a modal
  opened from a link closes with `replace`.
- Q19 reply 10–2000 characters, plain text.
- Q21 without mocks the company portal shows error states (as the customer portal).
- Q22 mocked password: current password `wrong` = error.
- Q23 attachments listed by name only.

Other choices made during the build:

- Privacy also removes the China receiver's name and phone (approved in B1).
- Numbers in the company portal (KPIs, counts) use Western digits like the money format.
- Dates use the site's date format (Arabic-Indic digits in Arabic, as elsewhere).
- Order details reuse the New Request summary: same labels, option names and reference names.
- The client type is the only contact field shown.
- The inquiry modal's "first 3 visible fields" skip the customer section (it holds only the
  client type).

## Beyond the spec

- **Shared portal frame:** the customer and company portals use the same sidebar / top bar /
  drawer components (no visual change for customers).
- **Accessibility fix in both portals:** sidebar badge links had no spaces in their accessible
  name ("Requests5requests…"); they now have an explicit name.
- Mock-only demo endpoints `POST /api/company/demo/reset` and
  `PATCH /api/company/demo/offer-submission` (never part of the real API).
- Old edit links (`?edit=`) of an offer past review show "can no longer be edited".

## Tests

- shared 140 · backend 146 · frontend 222 · E2E 97 (desktop + 360 px, AR + EN).
- Privacy:
  - mock API tests over every endpoint;
  - E2E checks every `/api/company/*` response the browser receives;
  - no client name / phone, no competitor id / name / alias, no `contact` / `receiver*` /
    `companyId` key.
- Flaky-test fixes: the long New Request E2E got `test.slow()`; the company UI tests wait 5 s
  (they flaked at the 1 s default under the full parallel run).

## Open items

- Deployed preview + Lighthouse (needs the hosting accounts); demo video (both logins from
  `/login`, every section, desktop + mobile, AR + EN).
- Remove the demo company before launch (`--remove --yes`).
- The demo email domain (`mirhalgo.com`) is being confirmed.
- Real backend for the company portal, admin assignment, notifications: out of scope.
- Flaky E2E to investigate: customer sign-up (1 failure in 7 runs, 2026-11-24).
- Team Lead confirmation of the decisions above and of decisions 1–29 (MW_002 / MW_003).
