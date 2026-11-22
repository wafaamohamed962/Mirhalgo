# MirhalGo (مرحال جو)

Shipping marketplace built in Egypt.

- **MW_001** ([spec](docs/MW_001.md)): landing page, customer sign up with email OTP, login
  (email or phone), forgot password, persistent session.
- **MW_002** ([spec](docs/MW_002.md)): **A.** shipping-company registration (4-step wizard,
  documents, email OTP, application status, full stack) · **B.** customer portal (`/app`:
  New Request, My Orders, Companies, Account, Notifications, Help & Support), frontend only on
  an MSW mock API whose shapes match the future real API.

```
React SPA (Vercel / Netlify / Cloudflare Pages)
   │  supabase-js (anon key only, session)      fetch → /api/*
   ▼
Node/Express API (Render, Frankfurt)  ── service-role key, SMTP, OTP logic
   ▼
Supabase (Central EU, Frankfurt): Auth + Postgres
```

| Folder                | What                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `apps/web`            | Vite + React 18 + TypeScript + Tailwind v4, React Router, TanStack Query |
| `apps/web/src/mocks`  | MSW handlers + fixtures for the customer portal (MW_002 B)               |
| `apps/api`            | Express 4 API: auth, contact, company registration, own email OTP        |
| `packages/shared`     | Zod schemas + types used by **both** web and api (`@mirhalgo/shared`)    |
| `supabase/migrations` | Database schema + RLS (the only way to change the schema)                |
| `docs`                | Spec, image credits                                                      |

## Requirements

- Node.js 22.12+ and npm 10+ (MSW 3 needs 22.12)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (to push migrations)
- Gmail account `mirhalgov1@gmail.com` with 2-Step Verification and an **App Password**

## 1. Install

```bash
git init            # if not already a git repo (needed for the Husky pre-commit hook)
npm install
npm run build -w packages/shared   # required before running web/api, and after editing shared
```

## 2. Environment variables

Copy the blocks from [`.env.example`](.env.example) into two files. **Never commit them.**

**`apps/web/.env`** (public, ends up in the browser bundle):

| Variable                     | Value                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`          | `https://wpcpxmwkihaismxbdxip.supabase.co`                             |
| `VITE_SUPABASE_ANON_KEY`     | Supabase → Project Settings → API keys → **anon / publishable**        |
| `VITE_API_URL`               | `http://localhost:4000` (prod: the Render URL)                         |
| `VITE_USE_MOCKS`             | `true`: customer-portal data from the MSW mocks (until the API exists) |
| `VITE_SHOW_COMPANY_IDENTITY` | `true` (default) · `false` hides company names in the directory        |

**`apps/api/.env`** (secret, server only):

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

```bash
supabase login
supabase link --project-ref wpcpxmwkihaismxbdxip
supabase db push            # applies supabase/migrations
```

Dashboard settings (Authentication):

- **Confirm email: ON** (unverified users cannot log in).
- **Allow new users to sign up: OFF**: signup only through our backend (Admin API).
- Supabase's own email templates are unused: we create users through the Admin API and send
  our own OTP emails.

The migrations also create the private Storage buckets `company-documents` (5 MB, PDF/JPG/PNG)
and `company-logos` (2 MB), plus a restrictive policy: only the backend can read or write them.

Unverified company applications older than 7 days can be removed (files, user, rows) with
`npm run cleanup:companies -w apps/api` (not scheduled yet).

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
| `npm run test:e2e -w apps/web` | Playwright: critical flows on desktop + 360 px mobile |
| `npm run format`               | Prettier                                              |

The E2E tests build the app and mock the API + Supabase at the network layer, so they need
no credentials. The customer portal runs on a second build with `VITE_USE_MOCKS=true`, like the
preview. First run: `npx playwright install chromium`.

**Customer portal mocks:** `apps/web/src/services/api/portal.ts` is the service layer (one
function per future endpoint, typed with `@mirhalgo/shared/portal`). MSW answers them from
`src/mocks` with ~400 ms latency; mutations change the mock state until the page is reloaded.
**Exception: the user's own identity is real.** `getMe` / `updateProfile` read and write the
logged-in user's `profiles` row through RLS (`services/api/ownProfile.ts`): first/last name,
gender, email, phone. Only the avatar image is still mocked. Email/phone are read-only (the
"Change email/phone" buttons are hidden until the real API supports it).
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

## 7. Deploy

### API → Render (region **Frankfurt**)

1. New **Web Service** from the repo, root directory = repo root, region Frankfurt.
2. Build command: `npm ci && npm run build -w packages/shared && npm run build -w apps/api`
3. Start command: `npm run start -w apps/api`
4. Health check path: `/api/health`
5. Environment: every `apps/api/.env` variable above. Set `CORS_ORIGINS` to the deployed web
   origin(s) and `NODE_ENV=production`.

The rate limiter uses in-memory storage: keep a **single instance** (or add a shared store
before scaling out).

### Web → Vercel, Netlify or Cloudflare Pages

| Host                           | Settings                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Netlify / Cloudflare Pages** | Base: repo root · Build: `npm run build -w packages/shared && npm run build -w apps/web` · Publish: `apps/web/dist`. SPA fallback: `apps/web/public/_redirects`.        |
| **Vercel**                     | Root directory: `apps/web` · Build: `cd ../.. && npm run build -w packages/shared && npm run build -w apps/web` · Output: `dist`. SPA fallback: `apps/web/vercel.json`. |

Environment: the `VITE_*` variables (`VITE_API_URL` = the Render URL, `VITE_USE_MOCKS=true`
for the preview).

After the domain is known:

- Replace `https://mirhalgo.com` in `apps/web/public/robots.txt` and `sitemap.xml`.
- Add `og:url` / `og:image` in `apps/web/index.html`.
- Add the web origin to the API's `CORS_ORIGINS`.

## 8. Images

Originals (4K, commercial-use licensed) live in `apps/web/src/assets/images/` (`hero/`,
`about/`, `services/`). They are never shipped: the site uses AVIF + WebP exports.

```bash
npm run images -w apps/web   # → apps/web/public/images/<name>-{640,1280,1920,3840}.{avif,webp}
```

The script (`apps/web/scripts/optimize-images.mjs`, uses `sharp`, dev-only) never upscales and
writes `apps/web/src/lib/images.json` (real size + available widths) for the `srcset`. Commit the
generated files. To replace a photo: overwrite the original, run the command, and update
[`docs/image-credits.md`](docs/image-credits.md) (source, author, license). The hero preload in
`apps/web/index.html` points at `/images/hero-*.avif`.

## Design tokens

All colors, typography, radius, shadows and motion live in
`apps/web/src/styles/tokens.css` (the only file with hex values) and are mapped into
Tailwind in `globals.css`. The default Tailwind palette is disabled.
