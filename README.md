# MirhalGo (مرحال جو)

Shipping marketplace built in Egypt.

- **MW_001** ([spec](docs/MW_001.md)): landing page, customer sign up with email OTP, login
  (email or phone), forgot password, persistent session.
- **MW_002** ([spec](docs/MW_002.md)): **A.** shipping-company registration (4-step wizard,
  documents, email OTP, application status, full stack) · **B.** customer portal (`/app`:
  New Request, My Orders, Companies, Account, Notifications, Help & Support), frontend only on
  an MSW mock API whose shapes match the future real API.
- **MW_003** ([spec](docs/MW_003.md), [PR notes](docs/MW_003-PR.md)): Arabic copy in MSA,
  company country → region, "Back to home" · **New Request, full stack**: reference data,
  request balance, server drafts + uploads, idempotent submit, 3 forms (international,
  domestic, China), success screen with print and PDF.
- **MW_004** ([spec](docs/MW_004.md), [plan](docs/MW_004-plan.md), [PR notes](docs/MW_004-PR.md)):
  one `/login` routed by role and company status (real `GET /api/me`) · a demo company seed
  script · the **company portal** (`/company`: Overview, Available requests, Our submitted
  offers, Competitor offers, Client inquiries, Account settings), frontend only on an MSW mock
  API that enforces the privacy rules and keeps the demo data per account.

```
React SPA (Vercel / Netlify / Cloudflare Pages)
   │  supabase-js (anon key only, session)      fetch → /api/*
   ▼
Node/Express API (Render, Frankfurt)  ── service-role key, SMTP, OTP logic
   ▼
Supabase (Central EU, Frankfurt): Auth + Postgres
```

| Folder                                | What                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `frontend`                            | Vite + React 18 + TypeScript + Tailwind v4, React Router, TanStack Query |
| `frontend/src/mocks`                  | MSW handlers + fixtures for the customer portal (MW_002 B)               |
| `frontend/src/features/requests`      | The New Request forms + success page (MW_003, real API)                  |
| `frontend/src/features/companyPortal` | The company portal (MW_004), on `src/mocks/company`                      |
| `backend`                             | Express 4 API: auth, contact, company registration, own email OTP        |
| `shared`                              | Zod schemas + types used by **both** web and api (`@mirhalgo/shared`)    |
| `backend/supabase/migrations`         | Database schema + RLS (the only way to change the schema)                |
| `docs`                                | Spec, image credits                                                      |

## Requirements

- Node.js 22.12+ and npm 10+ (MSW 3 needs 22.12)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (to push migrations)
- Gmail account `mirhalgov1@gmail.com` with 2-Step Verification and an **App Password**

## 1. Install

```bash
git init            # if not already a git repo (needed for the Husky pre-commit hook)
npm install
npm run build -w shared   # required before running web/api, and after editing shared
```

## 2. Environment variables

Copy the blocks from [`.env.example`](.env.example) into two files. **Never commit them.**

**`frontend/.env`** (public, ends up in the browser bundle):

| Variable                     | Value                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`          | `https://wpcpxmwkihaismxbdxip.supabase.co`                                                                   |
| `VITE_SUPABASE_ANON_KEY`     | Supabase → Project Settings → API keys → **anon / publishable**                                              |
| `VITE_API_URL`               | `http://localhost:4000` (prod: the Render URL)                                                               |
| `VITE_USE_MOCKS`             | `true`: customer-portal data from the MSW mocks (until the API exists). New Request is always real           |
| `VITE_SHOW_COMPANY_IDENTITY` | `true` (default) · `false` hides company names in the directory                                              |
| `VITE_DEMO_TOOLS`            | `true` on a staging / preview build: company portal demo tools (always on in development, off in production) |

**`backend/.env`** (secret, server only):

| Variable                    | Value                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `PORT`                      | `4000`                                                                                        |
| `SUPABASE_URL`              | same project URL                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys → **service_role / secret** (never in web)                                |
| `SMTP_HOST` / `SMTP_PORT`   | `smtp.gmail.com` / `465`                                                                      |
| `SMTP_USER`                 | `mirhalgov1@gmail.com`                                                                        |
| `SMTP_PASS`                 | the 16-character Gmail **App Password**                                                       |
| `CONTACT_TO`                | `mirhalgov1@gmail.com`                                                                        |
| `OTP_PEPPER`                | random, 32+ chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGINS`              | comma-separated web origins, e.g. `http://localhost:5173`                                     |

The API validates these at startup and exits with the list of missing names (values are
never printed).

## 3. Supabase setup (once)

The Supabase project lives in `backend/supabase/`. Run the CLI **from `backend/`** (or pass
`--workdir backend` from the root):

```bash
cd backend
npx supabase login
npx supabase link --project-ref wpcpxmwkihaismxbdxip
npx supabase db push --remote     # applies backend/supabase/migrations to mirhalgo_v1
npx supabase migration list --remote   # local vs remote
```

Dashboard settings (Authentication):

- **Confirm email: ON** (unverified users cannot log in).
- **Allow new users to sign up: OFF**: signup only through our backend (Admin API).
- Supabase's own email templates are unused: we create users through the Admin API and send
  our own OTP emails.

The migrations also create the private Storage buckets `company-documents` (5 MB, PDF/JPG/PNG)
and `company-logos` (2 MB), plus a restrictive policy: only the backend can read or write them.

The MW_003 migrations add:

- **Reference data** (countries, regions, cities, ports, airports, container / truck types,
  shipping lines, transit estimates), readable by everyone, written only by migrations. Truck
  types, container types and shipping lines are **placeholder** lists (`-- PLACEHOLDER` in
  `…20261122000003_reference_logistics.sql`) until the demo lists arrive.
- **Request balance:** `customer_balances` + the append-only `balance_ledger` (5 on email
  verification).
- **Orders:** `order_drafts`, `order_uploads`, `orders` and their detail tables, plus the
  `submit_order` function (one transaction).
- The private bucket **`order-attachments`** (10 MB; PDF, DOC/DOCX, XLS/XLSX, CSV, JPG, PNG,
  WEBP), backend only like the company buckets.

**Cleanup** (MW_003 B3): the API runs it every hour while it is running (one instance at a time,
through a lease row). It removes:

- uploads never attached to a draft or an order, after 24 h;
- drafts not saved for 30 days, with their files;
- unverified company applications after 7 days.

Run it by hand with `npm run cleanup -w backend` (companies only:
`npm run cleanup:companies -w backend`). On a host that sleeps (Render free), also schedule
`npm run cleanup -w backend` as a cron job.

### Demo company account (MW_004)

One approved demo company lets the team log in to the company portal from the normal `/login`
page. **Development and staging only.** Production gets it only with the Team Lead's approval.

- Company: "أليكس إكسبريس للشحن الدولي واللوجستيات", Egypt / Alexandria, international
  shipping and customs.
- Email `demo.company@mirhalgo.com`, phone `+201000000001`, commercial register `9990000001`,
  tax number `999000001`. These are clearly fake values, but they are unique in the database:
  override them with `DEMO_COMPANY_EMAIL` / `_PHONE` / `_CR` / `_TAX` if needed.
- The password comes from **`DEMO_COMPANY_PASSWORD`** in `backend/.env`. It must meet the sign-up
  password policy. Share it with the team privately and **never commit it**. The script never
  prints it.

The script uses the same code as a real company sign-up (shared schema, placeholder PDF
documents checked like uploads, the `create_company_registration` function). It then verifies
the email and moves the application to `approved` (actor `system`). It sends no email.

```bash
npm run build -w shared && npm run build -w backend   # the script runs from dist/
npm run seed:demo-company -w backend                  # dry run: validates, touches nothing
npm run seed:demo-company -w backend -- --yes         # creates (or re-approves) the account
npm run seed:demo-company -w backend -- --yes --reset-password   # also sets the password again
npm run seed:demo-company -w backend -- --remove --yes            # deletes it (rows + files)
```

- Without `--yes` it is a dry run: nothing is read from or written to the database.
- It always prints the target Supabase project.
- It refuses `NODE_ENV=production` unless `--allow-production` is given.
- Running it again is safe:
  - an existing demo account is only re-approved;
  - its password changes only with `--reset-password`;
  - an email that belongs to any other account (a customer, or a company with other legal
    numbers) is never changed.
- `--remove` deletes only that demo company.

## 4. Run (development)

```bash
npm run dev:api     # http://localhost:4000/api/health
npm run dev:web     # http://localhost:5173
```

## 5. Quality

| Command                        | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `npm run build`                | Build shared → api → web                              |
| `npm run lint`                 | ESLint (web) + type-check (api)                       |
| `npm test`                     | Vitest: shared schemas, API (supertest), web (RTL)    |
| `npm run test:e2e -w frontend` | Playwright: critical flows on desktop + 360 px mobile |
| `npm run format`               | Prettier                                              |

The E2E tests build the app and mock the API + Supabase at the network layer, so they need
no credentials. The customer portal runs on a second build with `VITE_USE_MOCKS=true`, like the
preview. First run: `npx playwright install chromium`.

**Customer portal mocks:** `frontend/src/services/api/portal.ts` is the service layer (one
function per future endpoint, typed with `@mirhalgo/shared/portal`). MSW answers them from
`src/mocks` with ~400 ms latency; mutations change the mock state until the page is reloaded.
**Exception: the user's own identity is real.** `getMe` / `updateProfile` read and write the
logged-in user's `profiles` row through RLS (`services/api/ownProfile.ts`): first/last name,
gender, email, phone. Only the avatar image is still mocked. Email/phone are read-only (the
"Change email/phone" buttons are hidden until the real API supports it).
**New Request is real** (MW_003), also with mocks on: the forms, drafts, uploads, orders,
reference lists and `/me/summary` pass through MSW to the API (`onUnhandledFrame: 'bypass'`;
real order references `MG…` pass through the mocked `/orders/:id`). My Orders, Companies and
Account › Balance are still mocked, so a real order does not appear in My Orders yet.

**Company portal mocks (MW_004):** `frontend/src/services/api/company.ts` (`companyApi`, one
function per spec B12 endpoint, typed with `@mirhalgo/shared/companyPortal`). MSW answers them
from `src/mocks/company` (fixtures: 6 fictional companies, 28 orders, offers, inquiries; 400 ms
latency) and behaves like the future backend:

- 401 without a session, 403 for a non-company account;
- **privacy in the handlers:** orders never carry client contact data (`toCompanyOrder` in
  `shared`), competitor offers come as "Competitor company #N" without id / name / alias, and
  companies that hide their offers are only counted;
- the rules: submit only on assigned open requests, with the order's template; edit only
  while under review; submit and edit blocked while submission is suspended; one final reply
  per inquiry.

Changes are saved **per account in `localStorage`** (`mirhalgo.companyDemo.v1.<userId>`), so
the demo survives a reload. Settings → **Demo tools** (dev, or `VITE_DEMO_TOOLS=true`): "Reset
demo data" and a switch that simulates a suspension of offer submission. Role and company
status are real (`GET /api/me`). The demo company login: see "Demo company account" above.

When the real API exists: implement the same endpoints, set `VITE_USE_MOCKS=false` and delete
`src/mocks` (+ `public/mockServiceWorker.js`). Demo codes in the mocks: OTP `123456`
(change email/phone, hidden for now), password `wrong` = error state.

## 6. Security summary

- Passwords are stored and hashed by **Supabase Auth** only.
- OTP is ours: 6 digits from `crypto.randomInt`, stored as `HMAC-SHA256(code, OTP_PEPPER)`,
  compared with `timingSafeEqual`, 10 min expiry, single use, 5 attempts (counted atomically
  in SQL), new code invalidates older ones, 60 s cooldown, max 5 codes / hour / email.
- No user enumeration: signup, resend and forgot password always answer the same way; login
  errors are always "Invalid email/phone or password".
- RLS on every table. Users read their own profile and may update only name/gender.
  `email_otps` and `contact_messages` are backend-only.
- Rate limits per IP + identifier (`express-rate-limit`), helmet, strict CORS allowlist,
  10 kb JSON limit, HTML-escaped user content in emails, audit logs without passwords/codes.
- Company registration (MW_002): shared Zod schema on both sides, files checked by **real
  content** (magic bytes) + size, images re-encoded with sharp (metadata stripped), PDFs never
  parsed, private buckets with random UUID names, all-or-nothing creation (one SQL transaction +
  compensation), 3 registrations / hour / IP. Duplicate email/phone → neutral answer; duplicate
  commercial register / tax number → `COMPANY_ALREADY_REGISTERED`.
- Roles live in `app_metadata.role` (only the backend can write it); a company can never open
  the customer portal. A password reset signs out every session.
- New Request (MW_003):
  - Every authenticated call is checked with `supabase.auth.getUser`, so revoked sessions are
    refused.
  - The same Zod schema validates on both sides; the server recomputes every derived value.
  - Order files are checked by content and never opened on the server. DOCX/XLSX with macros
    are refused.
  - Submit is one transaction with a balance lock and an `Idempotency-Key`: a double click or
    two tabs never create two orders or spend twice.
  - The ledger can't be changed or deleted, even by the service role.
  - Storage paths and idempotency keys are never sent to clients.

## 7. Deploy

### API → Render (region **Frankfurt**)

1. New **Web Service** from the repo, root directory = repo root, region Frankfurt.
2. Build command: `npm ci && npm run build -w shared && npm run build -w backend`
3. Start command: `npm run start -w backend`
4. Health check path: `/api/health`
5. Environment: every `backend/.env` variable above. Set `CORS_ORIGINS` to the deployed web
   origin(s) and `NODE_ENV=production`.

The rate limiter uses in-memory storage: keep a **single instance** (or add a shared store
before scaling out).

### Web → Vercel, Netlify or Cloudflare Pages

| Host                           | Settings                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Netlify / Cloudflare Pages** | Base: repo root · Build: `npm run build -w shared && npm run build -w frontend` · Publish: `frontend/dist`. SPA fallback: `frontend/public/_redirects`.     |
| **Vercel**                     | Root directory: `frontend` · Build: `cd .. && npm run build -w shared && npm run build -w frontend` · Output: `dist`. SPA fallback: `frontend/vercel.json`. |

Environment: the `VITE_*` variables (`VITE_API_URL` = the Render URL, `VITE_USE_MOCKS=true`
for the preview).

After the domain is known:

- Replace `https://mirhalgo.com` in `frontend/public/robots.txt` and `sitemap.xml`.
- Add `og:url` / `og:image` in `frontend/index.html`.
- Add the web origin to the API's `CORS_ORIGINS`.

## 8. Images

Originals (4K, commercial-use licensed) live in `frontend/src/assets/images/` (`hero/`,
`about/`, `services/`). They are never shipped: the site uses AVIF + WebP exports.

```bash
npm run images -w frontend   # → frontend/public/images/<name>-{640,1280,1920,3840}.{avif,webp}
```

The script (`frontend/scripts/optimize-images.mjs`, uses `sharp`, dev-only) never upscales and
writes `frontend/src/lib/images.json` (real size + available widths) for the `srcset`. Commit the
generated files. To replace a photo: overwrite the original, run the command, and update
[`docs/image-credits.md`](docs/image-credits.md) (source, author, license). The hero preload in
`frontend/index.html` points at `/images/hero-*.avif`.

## Design tokens

All colors, typography, radius, shadows and motion live in
`frontend/src/styles/tokens.css` (the only file with hex values) and are mapped into
Tailwind in `globals.css`. The default Tailwind palette is disabled.
