# CLAUDE.md — MirhalGo

Context for Claude Code. Read this first in every session.

## 1. Project

**MirhalGo** (مرحال جو) is a shipping marketplace built in Egypt. A customer submits one
shipping request and receives price quotes from verified shipping / customs-clearance
companies.

**Repository status (2026-11-23): MW_001 + MW_002 + MW_003 + the navigation work are all
merged into `main` and pushed** (GitHub `wafaamohamed962/Mirhalgo`).

- MW_002 came in through PR #1 (`d0b08be`).
- `feature/mw-003` was merged with `--no-ff` (`b932487`): no conflicts, the merged tree is
  identical to `feature/mw-003`.
- On `main`: build, lint, shared 121 / backend 123 / frontend 135 tests and E2E 71 pass.
- The feature branches stay on GitHub. Local `feature/mw-002` has one commit more than
  `origin/feature/mw-002` (`6941628`, decisions 23–24); it is already in `main` through
  `feature/mw-003`.
- **Windows line endings:** `core.autocrlf=true` checks files out with CRLF while the repo stores
  LF, so `npx prettier --check .` flags every file after a fresh checkout. Content is fine:
  `npx prettier --check . --end-of-line auto` passes. Scripted text edits must also expect
  CRLF.
- Start new work on a new branch from `main`.

**Current task: MW_004** (branch `feature/mw-004`; spec `docs/MW_004.md`, plan
`docs/MW_004-plan.md`, see §16): role + company status routing, demo company seed script, and the
company portal (frontend only, MSW). **Plan approved 2026-11-24; in progress.**

**Previous task: MW_003** (merged into `main`; spec `docs/MW_003.md`, plan
`docs/MW_003-plan.md`, see §15): fixes (Arabic MSA, company country → region, back button) + the
full-stack New Request page + site-wide navigation (addition beyond the spec). Builds on
MW_001/MW_002 rules.

**Previous task: MW_002** (merged into `main`, PR #1; spec `docs/MW_002.md`, see §14): Part A company registration (full stack) + Part B customer portal (frontend only, MSW
mocks). MW_002 builds on MW_001 and does not override its design system, stack, security or OTP
rules.

**Previous task: MW_001** (in `main`): Landing page + Customer Sign Up (email OTP) + Login +
Forgot password + persistent session.

- **The full spec is `docs/MW_001.md`. It is the single source of truth.** Follow it exactly.
  Do not add features, libraries or behaviour that it does not ask for.
- Out of scope for MW_001: the shipping-company registration form, real dashboard features,
  the admin panel, SMS/phone OTP and payments.
- The developer works with a **Team Lead**. The spec says: _"don't guess on security
  decisions"_. If something security-related is unclear, **stop and ask** instead of choosing.
- The developer prefers explanations in Egyptian Arabic, with English technical terms kept
  in English.

## 2. Architecture

```
React SPA (Vercel / Netlify / Cloudflare Pages)
   │  supabase-js (anon key ONLY, for session handling)
   │  fetch → /api/*
   ▼
Node/Express API (Render, Frankfurt)  ── service-role key, SMTP creds, OTP logic
   ▼
Supabase (Central EU, Frankfurt, eu-central-1): Auth + Postgres
```

- **Supabase Auth** stores users, hashes passwords and issues/refreshes sessions. We never
  store passwords ourselves.
- Users are created by the **backend** through the **Supabase Admin API** with the email
  unconfirmed, so Supabase sends no emails of its own.
- **We build the OTP ourselves.** Do NOT use Supabase OTP / magic links or any third-party
  OTP service.
- Emails (OTP + contact form) are sent **only from the backend** with **Nodemailer + Gmail
  SMTP** (`mirhalgov1@gmail.com`, App Password, ≈ 500 emails/day).
- **The service-role key, SMTP password and OTP pepper must never reach the frontend.**

## 3. Repository layout (spec 8.3)

```
frontend/src/
  app/               router, providers (Query, Auth, i18n)
  components/ui/     Button, Input, PasswordInput, PhoneInput, OtpInput, Select, Checkbox, Card, Badge, Toast
  components/layout/ Navbar, MobileDrawer, Footer, Container, Section, ScrollToTop, LanguageSwitch
  sections/          Hero, About, Services, Contact
  features/auth/     pages, hooks (useAuth), api calls, guards
  lib/               apiClient, supabase client, utils
  i18n/              ar.json, en.json
  styles/            tokens.css, globals.css
  assets/images/     optimized AVIF/WebP + srcset sizes (logo SVGs in assets/images/logo/)
  services/api/      customer-portal service layer + TanStack Query hooks (MW_002 B)
  mocks/             MSW handlers + fixtures (customer portal, until the real API exists)
backend/src/         routes/, services/ (otp, mail, companies, storage), middleware/, schemas/,
                     i18n/ (ar.json, en.json: email copy + `t()`)
backend/supabase/    config.toml + migrations/ (Supabase CLI: run from backend/)
shared/src/          Zod schemas + types shared by web & api  (package name: @mirhalgo/shared)
docs/                MW_001.md (spec), image-credits.md
```

npm workspaces monorepo with top-level workspaces `shared`, `backend`, `frontend` (restructured
from `apps/web`, `apps/api`, `packages/shared`, `supabase/` on 2026-11-22). Package names are
unchanged (`@mirhalgo/web`, `@mirhalgo/api`, `@mirhalgo/shared`). The Supabase CLI runs from
`backend/` (it finds `backend/supabase/`, including the link state in `.temp/`).

## 4. Commands

```bash
npm install
npm run build -w shared   # REQUIRED before running web/api, and after editing shared
npm run dev:api                    # http://localhost:4000/api/health
npm run dev:web                    # http://localhost:5173
npm run build                      # shared → api → web
npm run lint                       # ESLint (web) + tsc --noEmit (api)
npm run format                     # Prettier
npm test                           # Vitest: shared + api + web
npm run test:e2e -w frontend       # Playwright (first: npx playwright install chromium)
npm run images -w frontend         # regenerate AVIF/WebP after changing a photo (sharp)
```

Always run `npm run build` and `npm run lint` after changes, and make sure both pass.

## 5. Tech stack

**Already installed**

| Area        | Choice                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Web         | Vite 6, React **18** (spec requires 18, do not upgrade to 19), TypeScript **strict**                          |
| Styling     | Tailwind CSS **v4** via `@tailwindcss/vite` (CSS-first config, no tailwind.config.js)                         |
| Lint/format | ESLint 9 flat config (+ jsx-a11y, react-hooks), Prettier (+ tailwind plugin), Husky + lint-staged             |
| API         | Express 4, helmet, cors, TypeScript (NodeNext modules, so use `.js` in relative imports), `tsx watch` for dev |
| Shared      | TypeScript + zod                                                                                              |

**Also installed (spec 8.1):** React Router **7** (lazy routes; v8 needs React 19) · TanStack Query ·
React Hook Form + `@hookform/resolvers` · react-i18next · `@supabase/supabase-js` · lucide-react ·
react-icons · Framer Motion · Sonner · Vitest + React Testing Library + jsdom · Playwright.
API: `@supabase/supabase-js`, nodemailer, express-rate-limit, zod, Vitest + supertest.
No other libraries without asking first.

## 6. Design system rules (spec section 2)

- **All tokens live in `frontend/src/styles/tokens.css`.** It is the ONLY file allowed to
  contain hex values. `globals.css` maps the tokens into Tailwind with `@theme inline`.
- **The default Tailwind palette is disabled** (`--color-*: initial`), so only MirhalGo colors
  exist. Never hard-code hex/rgb in components (this is an acceptance criterion).
- Raw token names differ from theme names to avoid self-referencing variables:
  `--rad-*` → `rounded-*`, `--elev-*` → `shadow-*`, `--ff-*` → fonts, `--easing-out` → `ease-out`.
  Add new tokens the same way: raw var in `tokens.css` → mapping in `@theme inline`.

Available utilities:

| Kind        | Classes                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors      | `navy-900 navy-700 blue-600 blue-700 blue-800 sky-400 blue-50 violet-600 violet-100 white slate-50 slate-200 success warning error error-hover focus` (with `bg-`, `text-`, `border-` …) |
| Text colors | `text-heading text-body text-muted text-on-dark text-on-dark-muted text-link`                                                                                                            |
| Font sizes  | `text-display text-h1 text-h2 text-h3 text-base text-small text-caption` (mobile sizes switch at 768px). **Body size is `text-base`**, because `text-body` is the body _color_.          |
| Radius      | `rounded-sm` (12px: inputs, form buttons) · `rounded-lg` (20px: cards, modals) · `rounded-full` (pills, CTAs)                                                                            |
| Shadows     | `shadow-sm` (inputs) · `shadow-md` (cards) · `shadow-lg` (hover)                                                                                                                         |
| Layout      | `max-w-site` (1200px), section padding var `--section-py` (64 → 96px), `--navbar-height`                                                                                                 |
| Gradients   | CSS vars `--gradient-hero`, `--gradient-brand`, `--gradient-footer`                                                                                                                      |

- Buttons: height 44px (`--btn-height`), weight 600, focus ring 3px `--focus-ring-color`,
  disabled = 50% opacity + no hover, loading = spinner + disabled. Pill radius for CTAs,
  12px inside forms.
- Fonts: **Cairo** (Arabic) / **Inter** (English) from Google Fonts with `display=swap`.
  `html[lang='ar']` switches the body font to Cairo automatically.
- Motion: 150–300ms ease-out. `prefers-reduced-motion` is already handled globally.
- Text/background pairs must pass WCAG AA (≥ 4.5:1 for body text).

## 7. Coding conventions

- **Build the UI kit first** (`components/ui`) from the tokens, then pages. No one-off styles.
- **RTL/LTR:** use logical utilities only (`ms- me- ps- pe- start- end- text-start`). Never
  use `ml- mr- pl- pr- left- right-` for direction-dependent spacing. Default language is
  **Arabic** (`<html lang="ar" dir="rtl">`); i18n must update `lang` and `dir` and save the
  choice in `localStorage`.
- **All UI text comes from `i18n/ar.json` and `i18n/en.json`.** No hard-coded strings. The same
  applies to the backend: email copy lives in `backend/src/i18n/{ar,en}.json` (`t(lang, key, vars)`
  in `backend/src/i18n/index.ts`, `{{var}}` placeholders, typed keys); `mail/templates.ts` holds
  layout only. Keys and placeholders must match in both files (`backend/test/i18n.test.ts`).
  Format numbers and dates per locale.
- **Arabic copy is simple Modern Standard Arabic (فصحى مبسطة), never Egyptian colloquial**
  (decision 23): short, clear, professional. Fixed terms: تسجيل الدخول · إنشاء حساب ·
  كلمة المرور · البريد الإلكتروني · رقم الهاتف · رمز التحقق (not "كود") · الشعار (not "لوجو") ·
  المركبات (not "عربيات"). Imperatives in the masculine singular (أدخل، اختر، أرسل). Applies to
  `ar.json`, `i18n/portal/ar.json`, the Arabic email templates, `index.html` meta and the mocks.
  Enforced by `frontend/test/arabicCopy.test.ts` (deny-list + no Arabic hard-coded in code).
- Every input: label, error message, `aria-invalid`, `aria-describedby`.
- Every async action: loading, success and error states, and prevent double submit.
- Forms: React Hook Form + Zod schemas imported from `@mirhalgo/shared`. **The same schema
  is used on the server.**
- API responses are always `{ ok: true, data }` or `{ ok: false, error: { code, message } }`
  (types `ApiResponse` / `ApiSuccess` / `ApiError` in `shared/src/index.ts`).
  Error codes are UPPER_SNAKE_CASE and i18n-ready.
- API errors: throw `HttpError(status, code, message)` from
  `backend/src/middleware/errorHandler.ts`. The global handler never leaks stack traces.
- External links: `target="_blank" rel="noopener noreferrer"`.
- Images: commercial-use licensed, 4K source, AVIF/WebP with `srcset` 640/1280/1920/3840,
  lazy-load below the hero, preload the hero image. Record every image in
  `docs/image-credits.md`.

## 8. Code quality standards (apply to EVERY feature, fix and change)

Priorities: **Clean Code + High Performance + Readability + Maintainability + Reliability.**

1. **Clean Code**: readable, simple, well-structured code with meaningful names.
2. **DRY**: no duplicated logic. Shared rules go in `shared`, shared UI in
   `components/ui`, shared helpers in `lib/`.
3. **SOLID**: apply where it fits. Example: routes stay thin and call services
   (`services/otp`, `services/mail`). Business logic does not live in route handlers.
4. **Performance**: efficient queries (select only needed columns, indexes for lookup
   fields), no redundant API calls (TanStack Query caching), avoid unnecessary re-renders,
   route-level code splitting, optimized images.
5. **Maintainability**: modular, reusable, loosely coupled components and modules.
6. **Efficiency**: no unnecessary dependencies, computations or complexity. Before adding a
   package, check that the spec requires it or that it is clearly justified.
7. **Error handling**: handle errors and edge cases explicitly. API errors use `HttpError`
   - the global handler. The UI shows loading / error / empty states.
8. **Security**: follow §9. Never expose secrets.
9. **Refactoring**: remove dead code, unused imports and redundant logic in the code you touch.
10. **Consistency**: follow the existing conventions and architecture in this file.

**Rules**

- Preserve all existing functionality and business logic.
- Do not over-engineer or add abstractions that are not needed yet.
- Do not sacrifice readability for fewer lines of code.
- Avoid premature optimization.
- Make minimal, targeted changes whenever possible.
- **Test after every change:** `npm run build` and `npm run lint` must pass, plus the
  relevant tests or a manual check of the affected flow.

## 9. Security rules (mandatory, spec section 5)

- Validate on client AND server (shared Zod). Never trust the client.
- Secrets only in backend env vars. The frontend uses the Supabase **anon key** only.
- **RLS enabled on every table.** Users read/update only their own profile, never `role`
  or verification fields. The OTP and contact tables are backend-only.
- Rate limits (`express-rate-limit`, per IP + per identifier): login 10/15 min · signup
  5/hour · OTP send/resend 5/hour/email · OTP verify 5 attempts/code · contact 5/hour.
- HTTPS only, helmet, strict CORS allowlist (`CORS_ORIGINS`), JSON body limit 10kb.
  (helmet, CORS and the body limit are already done in `backend/src/index.ts`.)
- **No user enumeration** on login, signup and forgot password. Login error is always
  "Invalid email/phone or password". Forgot password always answers "If an account exists,
  we sent a code".
- Escape all user content placed in emails.
- Log auth events (signup, login success/fail, OTP sent/failed, password reset) with
  timestamp + IP. **Never log passwords or OTP codes.**
- Schema changes only through **Supabase migrations** in `backend/supabase/migrations/`, never
  manually in the dashboard.

### OTP rules (implement exactly)

- 6 digits from `crypto.randomInt` (never `Math.random`).
- Store only `HMAC-SHA256(code, OTP_PEPPER)`. Compare with `crypto.timingSafeEqual`.
- Expires after 10 minutes. Single use. Max 5 wrong attempts, then the code is invalidated.
- Issuing a new code invalidates previous unused codes of the same purpose
  (`signup` / `reset_password`).
- Resend: 60-second cooldown, max 5 codes/hour/email.
- Branded bilingual email (navy header, blue code box) with the code, the expiry and "If you
  didn't request this, ignore this email." **Never put the code in the subject.**

## 10. Environment variables (spec 8.6, see `.env.example`)

- `frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
- `backend/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_TO`, `OTP_PEPPER`, `CORS_ORIGINS`
- Commit `.env.example` only. **Never commit or print real secrets.** Never ask the user to
  paste the service-role key or SMTP password into chat.

## 11. Decisions already made

- Supabase project **`mirhalgo_v1`** exists in **Central EU (Frankfurt) `eu-central-1`**
  (URL `https://wpcpxmwkihaismxbdxip.supabase.co`). **Confirm email = ON.**
  "Allow new users to sign up" is currently ON (pending a Team Lead decision, see §13).
- React pinned to 18 (the Vite template shipped 19).
- Tailwind v4. Its built-in logical utilities replace the `tailwindcss-rtl` plugin.
- ESLint is used, as the spec asks (the template's oxlint was removed).
- Logo: the official PNG was vectorised into 4 SVGs in `frontend/src/assets/images/logo/`:
  - `mirhalgo-mark-white.svg`: navbar (dark hero and navy navbar), with the text
    "MirhalGo" next to it
  - `mirhalgo-mark.svg`: light backgrounds and favicon (`public/favicon.svg`)
  - `mirhalgo-logo.svg`: footer (light gradient)
  - `mirhalgo-logo-white.svg`: dark backgrounds (e.g. OTP email header)
  - Logo color is `#122A3B` (kept as the original, so it is close to but not equal to navy-900).
- **Signup duplicates (no enumeration):** `POST /auth/signup` always gives the same neutral
  response. Email already verified → send an "account already exists" email instead of an OTP.
  Email exists but unverified → refresh that account's details/password and send a new OTP.
  Phone used by another account → email the submitted address "phone already registered".
- **Auto-login after OTP:** the client keeps the password in React memory only (never storage)
  and calls `POST /auth/login` after verify succeeds. If it was lost (reload), go to `/login`
  with "Email verified, please log in". No Supabase magic links / token minting.
- **PhoneInput:** custom component, no library. Curated country list in `@mirhalgo/shared`
  (`COUNTRIES`), Egypt strict (10/11/12/15 + 8 digits), others generic E.164.
- **Supabase "Allow new users to sign up": turn OFF** (the backend Admin API still works).
- Validation error messages are i18n keys (`validation.*`); API error codes are the typed
  `ErrorCode` union in `shared/src/api.ts`, translated as `errors.<CODE>`.

## 12. Status

**Done**

- Monorepo structure (spec 8.3), workspaces, Prettier, ESLint, Husky hook.
- Design tokens + Tailwind theme mapping + base styles (RTL default, fonts, focus ring,
  reduced motion, smooth scroll with `scroll-padding-top`).
- API skeleton: `GET /api/health`, helmet, CORS allowlist, 10kb JSON limit, 404 handler,
  global error handler. Verified responses: 200 / 403 CORS / 404 / 413.
- Shared API response types.
- Logo SVGs + favicon, `.env.example`, `docs/image-credits.md`.
- **Step 1, shared schemas** (`shared/src`): `api.ts` (response types, typed
  `ErrorCode`), `otp.ts` (OTP constants), `phone.ts` (countries, E.164 helpers),
  `password.ts` (rules + score for the strength meter), `schemas/fields.ts|auth.ts|contact.ts`.
  Vitest tests in `shared/test` (`npm test -w shared`). `sideEffects: false`
  so unused schemas are tree-shaken.
- **Step 2, UI kit** (`components/ui`): Button (+ `buttonClasses` for links), Input, Textarea,
  PasswordInput (+ PasswordStrength), PhoneInput, OtpInput, Select, Checkbox, Card, Badge,
  Toast (Sonner `Toaster`), Spinner, ComingSoon (inactive link + tooltip), ResponsiveImage.
  Shared recipes in `styles.ts`; a11y wiring in `useField.ts` + `Field.tsx`. Import `Toaster`
  directly (not via the barrel) in always-loaded code to keep the main chunk small.
- **Step 3, i18n + router**: `i18n/index.ts` (ar default, `mirhalgo.lang` in localStorage,
  updates `<html lang dir>`), `ar.json`/`en.json` hold ALL copy. `app/router.tsx`
  (`createBrowserRouter`, lazy `page()` helper), `app/providers.tsx` (TanStack Query),
  `app/RootLayout.tsx`. `lib/usePageMeta.ts` sets title/description/OG per page.
  React Router is pinned to **v7** (v8 needs React 19).
- **Step 4, layout**: Navbar (transparent → navy after 80px, IntersectionObserver active link),
  MobileDrawer (portal, focus trap, Esc), Footer (gradient, dynamic year), Container,
  Section/SectionHeader, ScrollToTop, LanguageSwitch, Logo, SocialLinks, NavActions,
  SimpleLayout (auth/404 pages), Reveal (Framer Motion `m` + `LazyMotion`), PageLoader.
- **Step 5, landing**: `sections/` Hero, About, Services, Contact (RHF + shared Zod, honeypot,
  toast). `pages/LandingPage.tsx`, `pages/NotFoundPage.tsx`. Images: see "Images wired" below.
  Social brand colors are tokens (`--brand-*`).
- **Step 6, migrations** (`backend/supabase/migrations/2026112000000{1,2,3}_*.sql`): `profiles`
  (owner select; update ONLY first_name/last_name/gender via column grants), `email_otps`
  and `contact_messages` (RLS on, no policies, privileges revoked = backend only), SQL
  function `claim_otp_attempt` (row lock → atomic attempt counting; execute = service_role
  only). Verified on Postgres (PGlite) during development: RLS, grants, attempt limit.
  Pushed to the remote project on 2026-11-20.
- **Step 7, API**: `app.ts` (createApp, used by tests) + `index.ts` (listen). `config.ts` +
  `schemas/env.ts` (env validated at startup, values never printed). `lib/supabase.ts`
  (service-role `db` + throw-away sign-in client), `lib/logger.ts` (`logEvent`: JSON audit
  lines with timestamp + IP, masked email, never passwords/codes). `services/`: `otp.ts`,
  `mail/` (Nodemailer, bilingual templates, `escapeHtml`; every SMTP error → `MAIL_FAILED`),
  `users.ts`, `auth.ts`, `contact.ts`. `middleware/`: `validateBody`, `respond`, `rateLimit`
  (in-memory store, per IP + per identifier). `types/database.ts` = hand-written Supabase
  types (keep in sync with migrations). Tests: `backend/test` (Vitest + supertest).
- Login returns `{ status: 'authenticated', session }` or
  `{ status: 'verification_required', email }` (correct password, unverified email).
- **Step 8, web auth**: `lib/supabase.ts` (anon key, persistSession + autoRefreshToken),
  `lib/apiClient.ts` (`apiPost`, `ApiRequestError`, `errorKey`), `lib/forms.ts`
  (`useZodForm`), `lib/useCountdown.ts`. `features/auth/`: `AuthProvider` (loads supabase-js
  lazily after first paint), `authContext`, `hooks/useAuth`, `hooks/useLogin`, `api.ts`,
  `guards.tsx` (ProtectedRoute / GuestRoute / PendingVerificationRoute),
  `pendingVerification.ts` (email in sessionStorage, password in memory only),
  `components/AuthCard|ResendCode`, `pages/` Login, SignupRole, SignupCustomer,
  CompanyComingSoon, VerifyEmail, ForgotPassword. `pages/DashboardPage.tsx` (placeholder,
  reads own `first_name` through RLS, logout → `/`). `components/ui/Alert.tsx`.
- **Step 9, tests + SEO**: web unit tests in `frontend/test` (Vitest + RTL: i18n key parity,
  language switch, OtpInput, PasswordInput, PhoneInput, a11y wiring, guards). Playwright in
  `frontend/e2e` (production build, API + Supabase mocked in `e2e/mocks.ts`; desktop + 360px
  mobile): landing, RTL/LTR, no horizontal overflow, nav scroll, drawer, social links, contact,
  signup → OTP → dashboard → reload → logout, phone login + generic errors, unverified login,
  6th attempt, forgot password, company, 404. SEO: `index.html` defaults + OG, per-page meta,
  `public/robots.txt`, `public/sitemap.xml` (placeholder domain), SPA fallbacks
  (`public/_redirects`, `vercel.json`). Section links use `SectionLink` (JS scroll +
  replaceState): native hash jumps trigger a router POP whose scroll restoration cancels the
  smooth scroll. Navbar offset = each section's `scroll-margin-top` only.
- **Step 10**: README (setup, env, Supabase, run, tests, deploy, images).
- **Fix: missing web env no longer blocks navigation.** Without `frontend/.env`, supabase-js
  threw "supabaseUrl is required" inside the lazily loaded client, AuthProvider never left
  `loading`, and every guarded page (Sign Up, Login, service cards) spun forever. Now
  `lib/env.ts` checks the `VITE_*` values (one console message naming the missing ones),
  AuthProvider always finishes loading, `apiPost`/supabase throw `ConfigError` →
  `errors.CONFIG_MISSING` (translated), and `ServiceNotice` shows it on auth pages and the
  contact form. Regression test: `frontend/test/missing-env.test.tsx`.
- **Task 2, real backend connected (2026-11-20)**: `frontend/.env` + `backend/.env` exist
  (git-ignored; `OTP_PEPPER` generated, rotated once after being pasted in chat). Migrations
  pushed to `mirhalgo_v1` (`cd backend && npx supabase migration list --remote` = 3/3). Verified on the real
  DB (21 behavioural checks): RLS, column privileges, backend-only tables/function, constraints.
  Real API + browser flows pass: login email/phone, generic errors, persistent session after
  reopening the browser, logout, OTP verify / reuse / expiry / 5 attempts / reset (email delivery
  simulated by inserting the hash), contact form saved to DB, audit logs without secrets.
- `SMTP_PASS` is optional: empty → API starts with a warning and every email step returns
  `503 MAIL_NOT_CONFIGURED` (checked before any account lookup = no enumeration). Signup,
  resend, forgot password and the unverified-login code are blocked until it is set; the
  contact form still saves to the DB (`email_sent=false`) and answers success.
- **Task 3, hero shipping-routes animation. ADDITION BEYOND THE MW_001 SPEC** (requested by the
  developer, not in `docs/MW_001.md`): `sections/HeroRoutes.tsx`, inline SVG + CSS only
  (no library, no canvas). 3 curved dotted routes (sky-400 / blue-600 at 0.2–0.3 opacity),
  dashes flow via `stroke-dashoffset` (`--animate-route-dash`, 24 s ease-in-out), a plane and a
  ship move along the upper/lower route via CSS `offset-path` (`--animate-route-travel`, 30 s,
  fades at both ends). Above the hero overlay, below the text (`-z-10`), `aria-hidden`,
  `pointer-events: none`, mirrored in RTL. Under `sm` (and Lighthouse's mobile viewport): static
  routes only, no icons, no animation. `prefers-reduced-motion`: fully static (`motion-safe:`).
  E2E test in `e2e/landing.spec.ts`. Lighthouse could not be run locally (Chromium/lighthouse
  launcher hangs on this machine): measure on the deployed site.

- **Live test with Gmail SMTP (2026-11-20)**: `SMTP_PASS` set, "SMTP ready". On the real
  backend: signup → OTP email received in the `mirhalgov1@gmail.com` inbox → code entered →
  verify → auto-login → dashboard → logout → login with email → login with phone; forgot password
  sent the reset email; contact form saved + emailed (`email_sent=true`). NOT completed: entering
  the reset code from a real email (stopped before the code was provided; reset logic itself was
  verified on the real DB with a simulated delivery). Test data deleted afterwards.
- **Fix: logout sometimes ended on `/login`.** `await navigate('/')` did not reliably leave the
  dashboard before `signOut` cleared the session. Now AuthProvider exposes `signedOut` and
  ProtectedRoute redirects to `/` after a logout (otherwise `/login`); the dashboard just calls
  `signOut()`. Guard unit test added. Playwright `reuseExistingServer: false` (a leftover preview
  server had been silently tested with a stale build).
- **Images wired.** Originals in `assets/images/` (never bundled): `hero/hero.jpg` 5098×3399,
  `about/about.jpg` 6120×8160 (portrait), `services/international.jpg` 4032×3024,
  `services/domestic.jpg` 5021×3085, `services/china.jpg` 2160×3840 (portrait, < 3840 wide →
  exports stop at 1920). `npm run images -w frontend` (`scripts/optimize-images.mjs`, `sharp`
  devDependency, approved) → `public/images/<name>-<w>.{avif,webp}` + `src/lib/images.json`
  (size + widths) read by `lib/images.ts`. `ResponsiveImage` no longer has a placeholder mode.
  Hero preload (AVIF, `imagesrcset`) in `index.html`; hero eager + `fetchpriority=high`, the rest
  lazy. Hero overlay is mirrored in RTL (`--gradient-hero-rtl`) so the darker side stays behind
  the text: measured worst-case hero text contrast 5.9–8.1:1 (AR), 7.1–7.6:1 (EN desktop),
  4.64:1 (EN mobile subtitle, lowest; passes AA). E2E test for srcset/eager/lazy added.

**Acceptance criteria (spec section 9), status on 2026-11-20**

| Criterion                                                                        | Status                                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Design tokens, no hard-coded hex in components                                   | ✅ (only `tokens.css`; email templates inline brand hex by necessity)                                       |
| Navbar smooth scroll, active link, mobile menu                                   | ✅ E2E                                                                                                      |
| Hero: background image + navy overlay + CTA                                      | ✅ real photo, preload, overlay (mirrored in RTL), CTA                                                      |
| 3 service cards, licensed high-res images, `srcset`                              | ⚠️ images + AVIF/WebP `srcset` wired; licenses not recorded yet; `china.jpg` only 2160 px wide              |
| Contact form → Gmail + DB, success/error, rate limited                           | ✅ real backend (email delivered, row saved, 5/hour limit tested)                                           |
| Facebook + WhatsApp links, Instagram inactive                                    | ✅ E2E                                                                                                      |
| Footer like screenshot 3, dynamic year                                           | ✅ dynamic year; screenshot 3 not available to compare                                                      |
| Full AR/EN switch, RTL/LTR on every page                                         | ✅ E2E + screenshots                                                                                        |
| Sign up → OTP email → verify → logged in → dashboard                             | ✅ real backend + real Gmail                                                                                |
| Unverified users blocked; wrong/expired/reused OTP rejected; 6th attempt blocked | ✅ real DB                                                                                                  |
| Login with email or phone; generic errors                                        | ✅ real backend                                                                                             |
| Session persists after reopening the browser; logout                             | ✅ real backend (logout race fixed)                                                                         |
| Forgot password end to end                                                       | ⚠️ real reset email sent + reset logic verified on real DB; entering a code from a real email not completed |
| Company button → "Coming soon"                                                   | ✅ E2E                                                                                                      |
| No secrets in the bundle; RLS on all tables                                      | ✅ bundle grep + 21 RLS checks on the real DB                                                               |
| Lighthouse mobile ≥ 90                                                           | ⏳ not measured (Lighthouse hangs locally) → measure after deploy                                           |

**Next steps, in order**

1. Turn OFF "Allow new users to sign up" in Supabase (still ON).
2. Fill source / author / license of every photo in `docs/image-credits.md` (marked **TODO**);
   check the airline logo in `international.jpg`; ideally a landscape ≥ 3840 px `china.jpg`.
3. Optionally finish the real forgot-password check with a code from the inbox.
4. Deploy (Render Frankfurt + static host), replace the placeholder domain, measure Lighthouse
   mobile (≥ 90) on the deployed site, demo video (AR + EN).

## 13. Open items (ask, do not assume)

- Supabase "Allow new users to sign up" is still ON (decision: OFF).
- The real database has one non-test account (`wa***@gmail.com`, created 2026-11-20 14:45,
  verified), probably the developer's own sign-up. Left untouched.
- Image sources/licenses unknown (TODO rows in `docs/image-credits.md`). `international.jpg` shows an
  airline logo (check the license allows it). `china.jpg` is portrait, 2160 px wide.
- Team Lead questions:
  - Logo color `#122A3B` vs navy-900 `#0B1B35`, and the name "MIRHAL GO" vs "MirhalGo".
  - Backend hosting: Render or Hostinger VPS?
  - After a password reset, should all other sessions be revoked? (Supabase does not revoke
    existing refresh tokens when the Admin API changes a password.)
  - Production domain (robots.txt, sitemap.xml, og:url) and an OG share image.
- `zod` 3.x has advisory GHSA-mrhx-c7xc-m3w5 (oversized collections). Not reachable here
  (10 kb JSON limit; MW_002 arrays all have `.max()` and the multipart `application` field is
  capped at 16 kb); upgrading to zod 4 is a separate migration.
- OTP email header uses a text wordmark: Gmail does not render SVG. A hosted PNG logo can
  replace it later.
- Screenshots 1, 2 and 3 referenced by the spec are not available yet.

## 14. MW_002: Company registration + Customer portal

**Spec:** `docs/MW_002.md` (copied from the developer's spec folder on 2026-11-21). Status:
**planning, waiting for approval. No code yet.**

**Scope**

- **Part A, full stack:** `/signup/company` 4-step wizard (Account & company → Services
  (conditional, skipped if only "Other") → Documents → Review) → email OTP (reuses
  `verify-email` / `resend-otp`, purpose `signup`) → "Application submitted" screen + email.
  `POST /api/companies/register` (multipart, shared Zod, magic-byte file checks, all-or-nothing
  with compensation, 3/hour/IP). Structured, queryable service data. Private bucket
  `company-documents`, UUID file names, no public URLs. Status lifecycle
  `pending_verification → pending_review → approved | rejected | changes_requested` + history
  log. Role-based routing; company accounts never reach `/app/*`; company sees an
  "Application status" page after login.
- **Part B, frontend only:** `/app/*` customer portal (sidebar / top bar / mobile bottom nav;
  New Request, My Orders + details, Companies directory + profile + rating, Account (7
  sections), Notifications, Help & Support). Data via `services/api` + TanStack Query, backed by
  **MSW** fixtures (~400 ms). Function names and response shapes must match the future real API.
- **Out of scope:** company login screen/portal, admin review UI, service request forms, real
  backend for Part B, payments, SMS.

**Decisions (2026-11-21, by the developer, PENDING final Team Lead confirmation; list them
as assumptions in the PR)**

Security

1. Duplicate email/phone → neutral response (same as MW_001 signup). Duplicate commercial
   register or tax number → explicit `COMPANY_ALREADY_REGISTERED` error.
2. Email exists but unverified: a company application in `pending_verification` → delete the
   old application, rows and files, accept the new one. A customer account → neutral response,
   change nothing.
3. Role: `app_metadata.role` is the source of truth, mirrored to `profiles.role`, written only
   by the backend.
4. Logo: private bucket until approval (no public bucket for now).
5. Files: magic bytes + size for all files; images re-encoded with `sharp` (API); PDFs checked
   by signature + size only, never parsed. Virus scanning is out of scope (future item).
6. No auto-login after the company OTP; show the "Application submitted" screen.
7. Draft in `localStorage`: never passwords, files, commercial register number or tax number;
   expires after 7 days; cleared on submit and on logout.
8. MW_001 follow-up: after a password reset, sign out all other sessions.

Data

9. Reference number `MG-C-YYYY-000123` from a DB sequence, generated at registration, shown
   after the OTP and in the emails.
10. Unverified applications: cleanup function deletes user, rows and files after 7 days
    (created now, scheduled later).
11. `TERMS_VERSION = "2026-11-21"`; Terms/Privacy pages stay placeholders.
12. Confirmation email to the company + short "new company application" notice to `CONTACT_TO`
    (no documents attached).
13. Free email providers (Gmail, Yahoo…) are allowed.
14. Ranges: commercial register 1–10 digits, landline 7–12 digits, years in business 0–100,
    fleet size 0–10000, website `http` or `https`.
15. "Other" vehicle type / "Other" China site → required text field (3–100 chars).
    "All governorates" is a boolean flag.
16. Served areas = the `COUNTRIES` list + regions: Gulf, Middle East, Europe, China, East Asia,
    North America, Africa.

Part B

17. MSW enabled on the deployed preview via an env flag; unhandled requests pass through (real
    auth).
18. `VITE_SHOW_COMPANY_IDENTITY` defaults to `true` (directory shows names; offers stay
    anonymous).
19. "Send to all in category" uses 1 request attempt, max 10 companies.
20. Top-bar search: orders by reference number only.
21. Date format options: `DD/MM/YYYY` (default) and `YYYY-MM-DD`.
22. **(2026-11-22, by the developer) Own identity is real, not MSW.** The logged-in user's
    first/last name, gender, email and phone come from their real `profiles` row (RLS owner
    select) via `services/api/ownProfile.ts` behind `portalApi.getMe` / `updateProfile` (same
    `Me` shape). Used by the welcome banner, the avatar menu and Account › Profile. Saving
    name/gender updates the real row (RLS/column grants: owner, those 3 columns only). Only the
    avatar image stays mocked (`GET/POST /me/avatar` in MSW; a failure falls back to initials).
    Email/phone are read-only: the mocked "Change email/phone" buttons are hidden
    (`CONTACT_CHANGE_ENABLED = false` in `ProfileSection.tsx`, code kept). Everything else stays
    mocked. The query cache is cleared whenever the signed-in user changes (`providers.tsx`).
23. **(2026-11-22, by the developer) Arabic copy changed from the spec's colloquial wording to
    MSA.** Every Arabic string (both `ar.json` files, Arabic email templates, `index.html`
    title/description/OG, mock fixtures) was rewritten in simple Modern Standard Arabic. This
    includes the spec's Arabic marketing copy (hero, about, services, footer), translated with the
    same meaning, e.g. hero "اشحن أي حاجة لأي مكان" → "اشحن أي شيء إلى أي مكان", leave dialog
    "امشي / خليك" → "مغادرة / البقاء". Same i18n keys and placeholders; English unchanged.
    `docs/MW_001.md` / `docs/MW_002.md` still quote the original colloquial copy: the app's
    `ar.json` is now the reference for Arabic wording.
24. **(2026-11-22, by the developer) Company draft: auto-restore instead of the spec's
    "Continue your application?" prompt.** On return the autosaved draft is restored
    automatically and a subtle inline notice is shown above the stepper
    (`components/DraftRestoredNotice.tsx`, `role="status"`, muted text + info icon): "تمت
    استعادة البيانات المحفوظة من زيارتك السابقة." / "We restored your saved progress." with a
    "البدء من جديد" / "Start over" link button (clears the draft, resets the form, back to step
    1, focus on the first field) and a dismiss button. Autosave itself is unchanged (same
    fields, 7 days, never passwords/legal numbers/files/consents, cleared on submit + logout);
    it only reacts to field edits, so restoring or starting over never writes a draft.

Implementation choices (proposed in the plan, not contradicted; confirm in review)

- Company `profiles` rows: `first_name` / `last_name` / `gender` become nullable for
  `role = company` (check constraint); the representative name lives in `companies`.
- Phone unique across all accounts through `profiles.phone`; WhatsApp/landline not unique.
- Storage path `{company_id}/{uuid}.{ext}`; status history with `actor_type` + `actor_id`.
- Validation messages follow the MW_001 convention: one fixed `validation.*` key per rule.
- Libraries: `multer` v2 (API) and `sharp` (API, decision 5) for Part A; `msw` and
  `react-easy-crop` for Part B. Magic bytes are checked by hand-written signatures.

**Progress**

- **Phase A1 done** (shared): `shared/src/company.ts` (enums/ids, `TERMS_VERSION`,
  limits), `files.ts` (`FILE_RULES`, `checkFile`, `detectMime` magic bytes),
  `schemas/company.ts` (one schema per wizard step + `companyRegistrationSchema`; stale hidden
  values are dropped by `z.preprocess` before validation), new `fields.ts` helpers, new
  `ErrorCode`s. Tests: `shared/test/company.test.ts`.
- **Phase A2 done** (migrations `backend/supabase/migrations/2026112100000{1..5}_*.sql`), pushed to
  `mirhalgo_v1` on 2026-11-21 (+ `…06_revoke_user_sessions.sql` from A3):
  1. `profiles`: names/gender nullable unless `role = customer`; only customers update their
     profile; backfill `app_metadata.role` for MW_001 users.
  2. `companies` (legal numbers unique, named constraints `companies_commercial_register_number_key`
     / `companies_tax_number_key` for decision 1), `company_services` (enum arrays + GIN),
     `company_documents` (owner reads metadata only, never `storage_path`).
  3. `company_applications` (reference default `next_company_reference()`),
     `application_status_history` written by an AFTER trigger that also validates
     transitions; `transition_application_status(id, to, actor_type, actor_id, note)`.
  4. `create_company_registration(...)` (security definer, service_role only): every row in one
     transaction, checks `app_metadata.role = company` and the 2 required documents.
     `list_expired_company_registrations(interval, limit)` for the cleanup (decision 10).
  5. Private buckets `company-documents` (5 MB, pdf/jpeg/png) + `company-logos` (2 MB,
     png/jpeg/webp) + a RESTRICTIVE storage policy denying anon/authenticated on both.
     Verified on PGlite with Supabase-like stubs (50 behavioural checks: atomicity, duplicates,
     constraints, lifecycle + actor, RLS/column grants, storage, cleanup, reference > 999999).
- **Phase A3 done** (API, `multer` v2 + `sharp` approved):
  - `POST /api/companies/register` (`routes/companies.ts`): `companyRegisterLimit` (3/h/IP,
    before parsing) → `middleware/upload.ts` (multer memory, 1 file per document type, 4 files,
    5 MB, one `application` field ≤ 16 kb; multer errors → API codes) → `parseApplicationField`
    → `validateBody(companyRegistrationSchema)` → `services/companies.ts`.
  - `services/companyFiles.ts`: magic bytes + per-type size; images re-encoded with sharp
    (EXIF/appended data removed, ≤ 4000 px, ≤ 50 MP input), logo → 512×512 WEBP; PDFs untouched;
    UTF-8 file names recovered from busboy's latin1. `services/storage.ts`: UUID paths,
    upload (self-cleaning on failure), best-effort `removeFiles`.
  - `registerCompany` order: files checked → verified email (account-exists mail, neutral) →
    unverified non-company or non-replaceable (neutral, untouched) → legal numbers (409) →
    phone (phone-taken mail, neutral) → replace own pending application (files, then user) →
    create user (`app_metadata.role = company`) → upload → RPC → OTP. Any failure after the
    user exists → files + user deleted (`rollback`); unique violations mapped by constraint name.
  - `verify-email` → `completeCompanyVerification` (status first, then email confirm; both
    idempotent): `pending_review` + confirmation email + team notice; returns
    `VerifyEmailResult` with the reference. Login returns `role` (app_metadata, profile
    fallback, none → INVALID_CREDENTIALS). Customer signup never touches an unverified company.
    Reset password → `revoke_user_sessions` (decision 8). Customers get `app_metadata.role`.
  - Cleanup: `cleanupExpiredRegistrations()` + `npm run cleanup:companies -w backend` (not
    scheduled).
  - Tests: `companyFiles`, `companies`, `companiesHttp`, `authRoles` (+ existing).
  - Real backend (Supabase + Gmail, 2026-11-21, 16 checks, run twice): register, storage
    (private, UUID names, EXIF stripped, logo WEBP), verify → pending_review + history, login
    role (email/phone), company RLS + storage denied, CR/tax 409, email/phone neutral, replace
    pending, unverified customer untouched, EXE/missing file rejected, cleanup, reset revokes
    the refresh token. Logs: no passwords/codes/full emails. Test data deleted. OTP delivery was
    simulated by planting a known hash (the real emails were also sent). Script kept outside
    the repo (scratchpad `e2e-company.mjs`).
- **Phase A4 done** (web wizard, `react-easy-crop` approved):
  - UI kit: `Modal`, `ConfirmDialog`, `CheckboxGroup` / `RadioGroup` (cards or chips), `Switch`,
    `FileUpload` (drag & drop, preview, replace/remove), `ProgressBar`, `Stepper`. Focus trap
    shared in `lib/useModalBehavior.ts` (MobileDrawer uses it too). `PhoneInput` shows a value set
    from outside (`splitE164` in shared). `apiUpload` (XHR, upload progress) in `lib/apiClient.ts`.
  - `features/companyRegistration/`: `model.ts` (step schemas = shared schemas + file presence;
    the resolver follows the current step), `draft.ts` (decision 7: no passwords, legal numbers,
    files or consents; 7 days; cleared on submit + logout), `api.ts` (multipart + `checkPickedFile`:
    magic bytes in the browser too), `options.ts`, steps in `components/`, `LogoCropper` (own
    chunk, 512 px PNG), pages `CompanyRegistrationPage` (`/signup/company`, guest only) and
    `ApplicationSubmittedPage` (`/signup/company/submitted`). Leave guard: `useBlocker` +
    `beforeunload`. Submit errors jump to the step of the first invalid field; file errors →
    Documents.
  - `/verify-email`: role `company` → submitted screen with the reference (no login, decision 6).
    `pendingVerification` stores the kind (customer/company). The "Coming soon" page was removed.
  - "Countries served" = `COUNTRIES` without Egypt.
  - Tests: `test/companyDraft.test.ts`, `test/companyRegistration.test.tsx` (Next validates one
    step, skip, Back keeps data, renamed EXE rejected, submit payload, draft restore, leave
    dialog); E2E company flow (desktop + mobile). Real check: browser → API → Supabase → OTP →
    submitted screen.
- **Phase A5 done** (role routing, spec A6): `features/auth/roles.ts` (`roleOf(session)` from the
  JWT `app_metadata.role`, `homePath(role)`: customer → `/app`, company → `/application-status`),
  `ProtectedRoute allow={[…]}` (other roles → their home), `HomeRedirect` on `/dashboard`, login
  and verify navigate by role. `features/companyPortal/ApplicationStatusPage` reads its own
  application through RLS (`company_applications` + `companies(legal_name)`). `LogoutButton`.
- **Phase A6 done**: README (MW_002, env flags, buckets, cleanup, mocks, security), real checks:
  company logs in → `/application-status` "Pending review", `/app/*` and `/dashboard` bounce
  back; customer logs in through the MSW passthrough → mocked portal; reload keeps the session.
- **Part B done** (`msw` 3, treated as approved: spec + decision 17):
  - Contract: `shared/src/portal.ts` (every response type + constants) and
    `schemas/portal.ts` (profile, address, reason, question, review, ticket, password, delete).
  - Service layer `frontend/src/services/api/portal.ts` (`portalApi.*`, authenticated
    `apiRequest` with the Bearer token) + `queries.ts` (query keys, hooks, `useApiMutation` =
    success/error toasts + cache sync).
  - Mocks `frontend/src/mocks`: `fixtures.ts` (fictional companies/people), `db.ts` (in-memory
    state, reset on reload), `handlers.ts` (`createHandlers(db, { latency })`, 400 ms),
    `browser.ts` (worker, `onUnhandledFrame: 'bypass'`). Started in `main.tsx` only when
    `VITE_USE_MOCKS=true` (own chunk). Demo codes: OTP `123456`, password `wrong` = error.
  - Flags in `lib/env.ts`: `flags.useMocks`, `flags.showCompanyIdentity`
    (`VITE_SHOW_COMPANY_IDENTITY`, default true; off → "MirhalGo Partner #NNN" with a stable
    number, `features/portal/components/companyIdentity.ts`). Offers are always anonymous.
  - Shell `features/portal/layout/PortalLayout`: sidebar on the start side (right in AR),
    collapsible (saved in localStorage; collapsed by default < 1280 px), top bar (title from the
    route `handle`, order search → `/app/orders?search=`, bell, avatar menu), mobile bottom nav +
    "More" drawer. Portal copy is its own chunk: `i18n/portal/{ar,en}.json` (imported by the
    layout).
  - Pages (lazy, routes in `app/router.tsx` via `portal(path, title, load)`): `requests/`
    (New Request; its service placeholder and success modal were replaced by the MW_003 B5 forms
    and the B6 success page), `orders/` (list with tabs/counts/search/sort/load more; details with Details ·
    Offers · Timeline, accept/reject/ask/compare/cancel), `companies/` (directory, bulk bar, send
    to category ≤ 10, profile, reviews, rating only after a completed order), `account/` (7
    sections; profile with avatar crop + change email/phone OTP UI + unsaved guard), `notifications/`,
    `support/` (FAQ search, contact, tickets + conversation).
  - New UI kit: Skeleton, QueryState/EmptyState/ErrorState, Tabs (+ `tabPanel.ts`), Popover,
    Avatar, StarRating(+Input), Accordion. Shared: `components/ImageCropper` (logo + avatar),
    `lib/useUnsavedChangesGuard`, `lib/useDebouncedValue`, `lib/dateFormat` (decision 21),
    `lib/money`.
  - Tests: `frontend/test/portal/*` (MSW node server, same handlers, latency 0: 24 tests) +
    `e2e/portal.spec.ts` (second Playwright build with mocks on, port 4174: RTL/LTR sidebar side,
    mobile bottom nav, no overflow on 10 pages, walk-through).
  - Main web chunk: 428 kB raw / 138 kB gzip (portal copy split out). The MSW chunk (≈ 290 kB) only loads when
    mocks are on.

- **Fix (2026-11-22): forgot-password 500 `PGRST125`.** Cause: `SUPABASE_URL` in `backend/.env`
  (and both URLs in `.env.example`) ended in `/rest/v1/`; supabase-js appends that path itself, so
  every query hit `/rest/v1/rest/v1/<table>` and every sign-in failed with no error code (logged as
  `no_session`). Fixed the env files; `isSupabaseProjectUrl` (`shared/src/env.ts`) now
  makes the API refuse to start and the web treat `VITE_SUPABASE_URL` as missing when it has a
  path. Tests: `shared/test/env.test.ts`, `backend/test/env.test.ts`,
  `frontend/test/missing-env.test.tsx`. Real backend (29 checks): legacy customer without
  `app_metadata.role` login email/phone, forgot → reset → old token revoked, signup → resend →
  verify → login, both real MW_001 customers have the role backfilled. Test data deleted.

**Open items**

- Team Lead confirmation of decisions 1–21.
- Lighthouse mobile ≥ 90 (landing + portal) still not measured: Lighthouse hangs locally →
  measure on the deployed preview. With mocks on, the MSW chunk is part of the portal load.
- Mock state is in-memory (a reload resets it), as spec B2 says "for the session".
- Mocked content still contains the fixture customer's name: a review the user writes is
  listed as "منى ع." (the mock builds the author from its fixture) and one support-ticket reply
  greets "منى". The real API will use the real name; change the mock only if the demo needs it.
- Fix (2026-11-22): horizontal table scrollers must be `relative overflow-x-auto`. Without
  `relative`, absolutely positioned children (`sr-only` switch labels, captions) escape the
  scroller and widen the page (Account › Notifications overflowed 55–91 px on mobile, in both
  languages). The portal "no horizontal overflow" E2E now covers 18 pages.
- E2E: with MSW on, Supabase requests go through the service worker, so `mockSupabase` uses
  `context.route` + `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` (set in
  `playwright.config.ts`).
- Rollback after an RPC failure was verified with unit tests + PGlite, not on the real backend
  (the pre-checks prevent that failure path there).
- Ticket attachments are metadata only in the mock (the real API will need multipart).
- Committed on `feature/mw-002` and merged into `main` (PR #1); decisions 23–24 (`6941628`)
  reached `main` through `feature/mw-003`.

## 15. MW_003: Fixes + New Request page (full stack)

**Spec:** `docs/MW_003.md` (copied from the developer's spec folder on 2026-11-22).
**Plan:** `docs/MW_003-plan.md` (approved 2026-11-22 by the developer).
**Branch:** `feature/mw-003`, created from `feature/mw-002` (stacked), merged into `main` with
`--no-ff` on 2026-11-23 (`b932487`, no conflicts). The MW_002 decisions 23–24 work was committed
first on `feature/mw-002` (`6941628`).

**Scope**

- **Part A:**
  - A1: Arabic MSA audit plus a deny-list test (most of it was done by decision 23).
  - A2: company sign-up country (EG/SA/AE from the DB) → region (ISO 3166-2 ids), with
    country-specific region label, phone dial code, legal-number labels/validation and
    domestic coverage.
  - A3: "Back to home" on the company and customer sign-up pages, with a confirmation.
- **Part B, full stack:**
  - reference tables + `GET /api/reference/:list` (cached), searchable `Combobox` with flags
    and "Other";
  - request balance (`customer_balances` + append-only `balance_ledger`, 5 granted on
    verification) and `GET /api/me/summary`;
  - server drafts per user/service and uploads before submit (private bucket
    `order-attachments`, 24 h orphan cleanup);
  - `POST /api/orders`: atomic `submit_order` RPC, `Idempotency-Key`, `409 NO_BALANCE`, values
    recalculated on the server;
  - `GET /api/orders/:reference`;
  - 3 forms: international 6 steps, domestic 6, China 4;
  - success screen with print and PDF.
- **Out of scope:** My Orders / Companies / Account stay mocked; admin review; offers; balance
  restore/reset (the ledger is designed for it); payments.

**Key conflicts with MW_002 (details in plan §4):**

- Legal numbers become country-aware and unique per `(country_code, number)`.
- `companies.governorate` (enum) becomes `country_code` + `region_id` (FK, backfilled).
- `domestic_governorates[]` becomes the join table `company_domestic_regions`.
- Decision 24 (auto-restore) is kept.
- The mocks `/me/attempts` and `/requests/draft` are removed; order references become `MG####`.

**Decisions (2026-11-22, by the developer, PENDING Team Lead confirmation; list them as
assumptions in the PR)**

25. Uploads accept legacy DOC/XLS (OLE2 signature) and CSV (valid UTF-8 text, no NUL bytes) as
    the spec lists them, plus PDF, DOCX/XLSX (ZIP signature + Office entries, no
    `vbaProject.bin`), JPG/PNG/WEBP. Every file is validated by its content (magic bytes) and is
    **never opened, parsed or executed on the server**; it is served only as a download.
26. API auth: `supabase.auth.getUser(token)` on every authenticated request (respects sessions
    revoked after a password reset, decision 8). No local JWT verification.
27. Reference lists without a demo source (13 truck types, container types, shipping lines) are
    seeded with reasonable starter lists and marked **placeholder** (`-- PLACEHOLDER` comment in
    the seed migration + `docs/MW_003-plan.md`), to be replaced from the demo later.
28. Transit estimates are configurable rows in `transit_estimates`: Chinese sites air 15–25 /
    sea 45–60 days, SHEIN land 35–45, **SHEIN air 10–15 days** (default, not in the spec).
29. Every other open item uses the default proposed in plan §5 (items 4–24, 31–36), e.g.
    `MG` + sequence from 1001, idempotency columns on `orders`, 5 backfilled for verified
    customers, 30-day draft expiry, hourly in-process cleanup timer + npm scripts, Cairo date for
    "ready date", client-side PDF.

**Libraries:** `jspdf` + `html-to-image` (PDF, lazy chunk) follow plan §5 item 36 (default
accepted). `flag-icons` approved by the developer on 2026-11-22 (used from B1). Combobox, file checks,
scheduling and idempotency are built in-house.

**Progress**

- **Phase A1 done (2026-11-22).** Most of the MSA rewrite was already in MW_002 (decision 23).
  - Audit: every Arabic string (`ar.json`, `portal/ar.json`, emails, `index.html`, mocks) was checked for
    colloquial words and English written in Arabic letters. One fix: the mock company
    "دلتا كارجو للشحن" → "دلتا للشحن والنقل". Brand names (واتساب، فيسبوك، إنستغرام، شي إن، علي بابا،
    تاوباو) stay; Latin text in Arabic strings is limited to brands, file formats, URLs and the
    "DELETE" confirmation word.
  - `frontend/test/arabicCopy.test.ts` covers these rules:
    - a deny-list of colloquial and transliterated words, matched as whole words with prefixes and
      diacritics, in every Arabic source;
    - no Arabic letters in `frontend/src` / `shared/src` code outside comments (`mocks/`
      excepted), now including `backend/src` (no exceptions).
    - Add a word to the deny-list when review finds a new colloquial or transliterated term.
  - Email copy moved out of `backend/src/services/mail/templates.ts` into
    `backend/src/i18n/{ar,en}.json` (32 strings, `t()` helper, `resolveJsonModule`, JSON imports
    with `with { type: 'json' }`, copied to `dist/` by tsc). Checked: all 7 emails (subject,
    html, text) are byte-for-byte identical before and after; `dist` loads under plain Node.
  - `docs/ar-review.md` (key · Arabic · English, 20 sections, 856 strings) is generated for the
    native-speaker review. It is **not committed**: listed in `.git/info/exclude` (local only).
    Regenerate it after copy changes (generator script kept outside the repo, in the scratchpad).
  - For A2: the team-notice email still labels the location "Governorate / المحافظة". For B: the
    portal search placeholder still shows the `MG-R-…` reference format.
  - Still open: the native-speaker review of the final `ar.json` before merge (developer action).
- **Phase A2 done (2026-11-22).** Migrations pushed to `mirhalgo_v1` with the developer's OK
  (`npx supabase db push --remote --yes`; the CLI needs `--remote` and, in agent mode, `--yes`).
  - Migrations:
    - `backend/supabase/migrations/20261122000001_reference_countries_regions.sql`:
      - `countries`: 249 ISO codes, CLDR ar/en names, the dial codes known to the phone input,
        `company_signup` = EG/SA/AE.
      - `regions`: ISO 3166-2 ids (EG 27 with the web copy names, SA 13, AE 7),
        `unique (country_code, id)`.
      - Public read of active rows, no client writes. Generated by a script (scratchpad
        `gen-reference-sql.mjs`).
    - `…000002_companies_country_region.sql`:
      - `companies.country_code` + `region_id` replace `governorate`, with a composite FK
        `(country_code, region_id)` → regions.
      - `companies_legal_numbers_check` holds the per-country rules (`else false`).
      - Uniqueness is per `(country_code, number)`, with the SAME constraint names as MW_002.
      - `company_domestic_regions` replaces `domestic_governorates`. Its composite FKs make
        sure the region belongs to the company country.
      - `domestic_all_governorates` is renamed `domestic_all_regions`.
      - `create_company_registration` gets `p_domestic_regions text[]` (old signature
        dropped).
      - The `egypt_governorate` type is dropped.
      - The backfill maps all 27 governorates and fails loudly on any unmapped value.
    - Verified on PGlite (scratchpad `pg/verify-a2.mjs`, 23 checks):
      - MW_002 data (one company per governorate) migrated;
      - per-country legal rules and uniqueness per country;
      - a region of another country refused;
      - atomic registration, RLS, cascade.
  - Shared (`company.ts`, `schemas/company.ts`, `reference.ts`):
    - `COMPANY_COUNTRIES` and `COMPANY_COUNTRY_RULES`:
      - EG: CR 1–10 digits, tax 9 digits;
      - SA: CR 10 digits, VAT 15 digits;
      - AE: trade license 3–20 A-Z/0-9/hyphen (no hyphen at the ends), TRN 15 digits.
    - `country` + `region` in Step 1; `domestic.allRegions` / `regions`.
    - Legal numbers are validated per country (`validation.legal.<CC>.<registration|tax>`) and
      normalised (digits only, AE uppercase). `formatLegalNumber` is the input mask.
    - Stale values after a country change are dropped before validation: regions of the old
      country, and the own country among "countries served".
    - `GOVERNORATES` stays only for the mocked portal (addresses, directory).
  - API:
    - `GET /api/reference/countries?scope=all|company_signup` and `/regions?country=`
      (`services/reference.ts`):
      - in-memory cache of 10 min; a failed load is not cached;
      - `Cache-Control: public, max-age=600` + ETag;
      - `company_signup` = DB flag AND rules in the code.
    - `registerCompany` first runs `assertCompanyLocation`: the country is open for sign-up,
      and the region and covered regions exist and belong to it (else 400).
    - The legal pre-check is per country.
    - The team email shows "Region: Giza (EG)".
  - Web:
    - `services/api/reference.ts`: `useCountries`, `useRegions` (staleTime 1 h),
      `regionOptions` sorted by the localized name.
    - Step 1: Country → Governorate / Region / Emirate.
      - The selects are controlled, so a restored draft value survives the async options.
      - Load errors show a retry button.
      - A country change by the user clears the region, the covered regions, and the own
        country from "countries served".
    - `PhoneInput defaultCountry`: the dial code follows the country while the number is empty.
    - Step 2: coverage = the regions of that country ("All emirates"…).
    - Step 3: labels, hints, keyboard, mask and document names follow the country.
    - Review: region and country names.
    - Draft: country + region are kept (still never the legal numbers); regions of another
      country are dropped on restore.
  - Arabic "City / Area" label → "المدينة / الحي". It was "المدينة / المنطقة", which clashed
    with the Saudi "المنطقة" label just above it.
  - Tests:
    - shared 96, backend 89 (`reference.test.ts`, `companies.test.ts`);
    - frontend 77 (wizard: country switching, SA rules, coverage, draft restore of async
      selects);
    - the fixtures in `frontend/test/referenceFixtures.ts` are also served by the E2E
      `mockApi`;
    - E2E 43 passed; screenshots AR/EN at 360 px and desktop, no overflow.
  - Real backend (API + Supabase, scratchpad `a2-real-check.mjs`, 11 checks, test data deleted):
    - EG / SA / AE registrations are stored with country + region and covered regions as rows
      ("all regions" = the flag only); SA numbers are normalised, the AE license is uppercased.
    - 400 for: an Egyptian tax number in SA, a region of another country, an unknown region,
      a covered region of another country, a country not open for sign-up.
    - The same CR is refused twice in SA (409) but accepted in the UAE.
    - Verify → pending_review; RLS: own covered regions only, no client writes; reference
      tables are readable by anon and not writable.
  - Since the push, the company registration on `feature/mw-002` no longer matches the real
    DB (it still sends `governorate`). Only `feature/mw-003` does.
- **Phase A3 done (2026-11-22): "Back to home".**
  - `SimpleLayout backHome` (also on `AuthCard`) adds a header link on `/signup/company` and
    `/signup/customer`.
    - Phones show the short "Home / الرئيسية" (`common.home`), `sm`+ the full "Back to home".
    - The accessible name is always the full text; the arrow is mirrored in RTL.
  - The confirmation reuses `useUnsavedChangesGuard` (`useBlocker` + `beforeunload`), so the
    logo and every other link ask too.
    - Company: "Leave the form?" + "Your draft is saved on this device for 7 days. Passwords,
      legal numbers and files are not saved."
    - Customer sign-up (new guard, it has no draft): "Leave the form?" + "The information you
      entered will be lost." The guard is released right before the successful redirect.
  - Bug fixed (company draft):
    - Leaving within the 500 ms autosave delay used to drop the last edit, so "Your draft is
      saved" was not true. The pending save is now flushed on unmount.
    - A pending save could also bring the draft back after "Start over" or after a successful
      submit. It is now cancelled in both. A regression test fails without the fix.
  - Tests:
    - wizard (back home empty / with data, draft flushed, start over), new
      `test/signupCustomer.test.tsx`;
    - E2E on both sign-up pages, desktop + 360 px, AR/EN, no overflow;
    - totals: shared 96, backend 89, frontend 82, E2E 45.
- **Phase B1 done (2026-11-22).** Migration pushed to `mirhalgo_v1` with the developer's OK.
  Real check: all 9 lists through the API (8 delivery countries, EG cities 28, ports 113 / EG 12,
  CN airports 13, 7 / 13 / 20 options, 4 transit rows), anon PostgREST read OK, write refused (401).
  - `backend/supabase/migrations/20261122000003_reference_logistics.sql` (generated, scratchpad
    `gen-b1-sql.mjs`):
    - `countries.china_delivery`: EG SA AE KW QA BH OM JO (spec B5).
    - `cities`: 126 rows (`EG-CAIRO`…) for the 8 delivery countries + LY SD IQ LB TR.
    - `ports`: 113 rows with a stable id (`EG-ALEXANDRIA`) and `unlocode`. The LOCODE is set
      only where well known (98); the others are NULL until checked against the official list.
      Egypt has 12 ports (the domestic form's list).
    - `airports`: 103 rows, IATA id. "Any airport" is a flag on the order, not a row.
    - PLACEHOLDER lists (decision 27): `container_types` 7 (spec), `truck_types` 13,
      `shipping_lines` 20 (brand names, same text in both languages).
    - `transit_estimates` (source × method → min/max days): China sites air 15–25 / sea 45–60,
      SHEIN air 10–15 (decision 28) / land 35–45.
    - Same RLS as A2: public read of active rows, no client writes.
    - PGlite (scratchpad `pg/verify-b1.mjs`): counts, constraints, RLS on every table.
  - Shared `reference.ts`: `ReferenceLists` maps each list to its item type
    (`ReferenceCity/Port/Airport/Option`, `TransitEstimate`), `COUNTRY_FILTERED_LISTS`,
    scopes `all | company_signup | china_delivery`.
  - API `GET /api/reference/:list`:
    - all 9 lists through one table-driven service (`LOADERS` + one cache per list);
    - `?country=` for regions / cities / ports / airports.
  - Web:
    - `services/api/reference.ts`: `useReference(list, params)`, plus `comboboxOptions`
      (localized label, flag, the other language as a search keyword, optional code) and
      `countryOptions`.
    - `components/ui/Combobox.tsx`: WAI-ARIA combobox (`aria-activedescendant`; keys
      ↓↑ Home End Enter Esc Tab; Enter never submits), a flag inside the input and in the
      options, a code hint, an optional "Other" (`COMBOBOX_OTHER`, always offered),
      loading / "No matches".
    - `Flag.tsx` (flag-icons).
    - `lib/search.ts`: `normalizeSearch` / `matchesSearch` (Arabic diacritics + the hamza /
      madda that NFD splits off أ إ آ, letter variants, Latin accents, Arabic digits).
  - Bundle:
    - `Combobox` and `Flag` are NOT in the `components/ui` barrel: import them from their
      files, so only pages that use them load the flag stylesheet.
    - `vite.config.ts` never inlines flag-icons SVGs. Before this, they made one 421 kB
      stylesheet on a shared chunk.
    - Checked with a probe: the chunk CSS is 30 kB, the flags are 0.2 kB files loaded when
      shown, and the main CSS is unchanged (42 kB).
  - Tests:
    - backend `reference.test.ts` (B1 lists, filters, `china_delivery`);
    - web `combobox.test.tsx` (ARIA, keyboard, filtering incl. Arabic spelling, Other,
      errors, option helpers);
    - `referenceFixtures.ts` has every list (unit + E2E);
    - totals: shared 96, backend 91, frontend 90, E2E 45. Screenshots AR/EN at 360 px.
  - Open:
    - Arabic names of ports / airports / cities / types live in the DB, not in `ar.json`, so
      they are not in `docs/ar-review.md` yet.
- **Phase B2 done (2026-11-22).** Migration pushed to `mirhalgo_v1` with the developer's OK.
  - `…000004_request_balance.sql`:
    - `customer_balances` (balance ≥ 0).
    - `balance_ledger`, append-only: type grant | consume | restore | reset; order_id (FK in B4);
      before / after; an i18n-ready `reason`; actor_type system | customer | admin; actor_id;
      a unique `unique_key`. The direction check makes consume exactly −1 and requires an order.
    - A trigger blocks UPDATE / DELETE for every role. The only exception is the
      account-deletion cascade (`pg_trigger_depth() > 1`).
    - `grant_balance()`: security definer, service_role only, customers only. It locks the
      balance row, then checks the key, so concurrent identical grants apply once.
    - RLS: the owner reads; the ledger columns `unique_key` / `actor_id` are hidden; no client
      writes.
    - Backfill: 5 for every verified customer (`initial_backfill`, key `initial:<id>`, the same
      key as the verification grant).
  - API:
    - `middleware/requireAuth.ts`: `requireRole` / `requireCustomer`. Bearer →
      `db.auth.getUser` (decision 26) → `app_metadata.role` (401 UNAUTHORIZED / 403 FORBIDDEN,
      new error codes); `authUser(req)`.
    - `services/balance.ts` (`grantInitialBalance`, `getBalance`).
    - `verifyEmail` grants 5 to customers; a failure is logged (`balance_initial_grant_failed`)
      and never fails the verification.
    - `GET /api/me/summary` → `MeSummary` { firstName, gender, balance { remaining, total },
      drafts: [] until B3 }. It repeats the idempotent grant for a verified customer without a
      balance (safety net).
  - Web:
    - `portalApi.getSummary` / `useMeSummary` (`keys.summary`) feed the welcome banner,
      the balance card, the "no requests left" block and the draft rows (one per service;
      Discard → `DELETE /orders/drafts/:service`, B3).
    - The MSW handlers `/me/attempts` and `/requests/draft` are removed (they pass through).
    - `db.attempts` stays only for the mocked Account › Balance page (decision 12: that page
      stays mocked).
  - Tests:
    - PGlite `pg/verify-b2.mjs` (9 checks);
    - backend `me.test.ts` (401/403, summary, safety-net grant) + `authRoles` (grant at
      verify, never fatal, not for companies);
    - portal tests with a stand-in for the real API (`renderPortal` `apiState`); E2E
      `mockPortalApi` + `summary`;
    - totals: shared 96, backend 97, frontend 91, E2E 45.
  - Real backend (scratchpad `b2-real-check.mjs`, 8 checks, test data deleted):
    - the backfill matches the ledger for both real verified customers;
    - signup → verify gives 5 with an `initial_grant` ledger row; the summary is correct;
    - the grant is idempotent;
    - 401 / 403 as expected;
    - RLS: own rows only, key hidden, no client write or RPC;
    - append-only holds even for the service role;
    - **after a global logout the old access token gets 401**;
    - deleting an account cascades through the ledger.
- **Phase B3 done (2026-11-22).** Migration pushed to `mirhalgo_v1` with the developer's OK.
  - Shared:
    - `orderFiles.ts`: purposes, limits (documents 10 MB, images 5 MB, 20 per order,
      10 screenshots, 60 pending per customer), `allowedOrderMimes` (screenshot = images),
      `checkOrderFile`.
    - `detectOrderMime` (decision 25): signatures for PDF and images; DOCX / XLSX from the ZIP
      central directory, refused with `vbaProject.bin`; DOC / XLS by OLE2 + extension;
      CSV = UTF-8 without NUL.
    - `schemas/drafts.ts`: `orderDraftSchema` (payload ≤ 60 000 chars, `service@n` form
      version, ≤ 20 unique upload ids), `OrderDraft`, `UploadedFile`.
  - `…000005_order_drafts_uploads.sql`:
    - `order_drafts`: unique (customer, service), payload ≤ 64 KB.
    - `order_uploads`: `storage_path` hidden by column grants; draft_id ON DELETE SET NULL;
      order_id (FK in B4); never both; screenshot = image.
    - `save_order_draft()`: upsert, then attach exactly the listed files (own, not ordered,
      free or already in this draft; ≤ 20 / ≤ 10 screenshots) and detach the rest.
    - `list_orphan_uploads(24 h)`, `list_expired_drafts(30 d)`.
    - `job_leases` + `claim_job_lease()`: PostgREST cannot hold an advisory lock across
      calls, so a lease row replaces the plan's advisory lock.
    - Private bucket `order-attachments` (10 MB, the 9 MIME types) + a RESTRICTIVE
      client-deny policy.
    - PGlite `pg/verify-b3.mjs` (8 checks).
  - API:
    - `POST /api/uploads` (`requireCustomer`, 60 / h per user, multer single `file`):
      checked by content, images re-encoded by `services/images.ts` (now shared with the
      company files), stored as `{customer}/{uuid}.{ext}`; the row insert is compensated.
    - `DELETE /api/uploads/:id`: own, not ordered.
    - `GET/PUT/DELETE /api/orders/drafts/:service`: a 64 KB JSON parser on `/api/orders`,
      mounted before the global 10 KB one; PUT 60 / min per user; a SQL check violation → 400;
      DELETE removes the files now.
    - `/me/summary` lists the drafts.
    - `services/cleanup.ts`: orphans (files first, rows only if the storage delete worked),
      expired drafts, MW_002 unverified companies (decision 10 is now scheduled).
      `startCleanupSchedule()` runs hourly in `index.ts` with the lease, and never throws.
      `npm run cleanup -w backend` runs it on demand. On a sleeping Render free instance,
      also schedule it externally.
  - Web:
    - `apiUpload(…, { auth })`; `apiRequest` supports PUT.
    - `services/api/orders.ts` (`ordersApi`); `portalApi.discardRequestDraft` reuses it.
    - `features/requests/components/AttachmentField.tsx`: content check in the browser
      (`features/requests/attachments.ts`), one upload + progress bar per file, max files,
      per-file errors with dismiss, remove = DELETE.
    - The draft autosave / restore hook is part of B5 (it needs the forms).
  - Bugs caught by tests:
    - two uploads finishing together overwrote each other (stale list) → the value is
      committed through a ref;
    - `form_version` check vs `service@n`.
  - Tests:
    - shared 101 (`orderFiles`), backend 111 (`orderDrafts.test.ts` over an in-memory
      Supabase fake), frontend 96 (`attachmentField`), E2E 45.
  - Real backend (scratchpad `b3-real-check.mjs`, 9 checks, test data deleted):
    - PDF, DOCX, CSV and PNG accepted (EXIF removed);
    - renamed EXE, macro XLSX, PDF-as-screenshot and an unknown purpose refused, nothing
      stored;
    - draft save / load / detach; the summary lists it;
    - a foreign file id → 400;
    - the client can read metadata only, has no bucket access and cannot call the RPC;
    - orphan cleanup works;
    - deleting an upload or a draft removes its files;
    - the lease allows one holder.
- **Phase B4 done (2026-11-23).** Migration pushed to `mirhalgo_v1` with the developer's OK.
  - Shared:
    - `orders.ts`: every option list of spec B3–B5 (= Postgres enums), `ATTACHMENT_SLOTS` +
      `SLOT_PURPOSE`, `ORDER_LIMITS`, `ORDER_FORM_VERSIONS`, `SubmitOrderResult`,
      `OrderRecord`.
    - `schemas/orders.ts`: `orderSchema` = a discriminated union by service of strict objects
      (international: shipment by mode with cargo by kind; domestic: container / general;
      china), plus one refine function per service. `orderSchemas` holds the per-service ones
      for the forms.
    - Rules:
      - hidden values → `validation.notAllowed`;
      - clearance location / point when the scope includes customs;
      - door services need addresses; trucking needs the address per side;
      - FCL = containers, LCL / air = loose, land container / FTL / LTL;
      - target price only for sea;
      - hazardous → MSDS (per product for manual products);
      - manual → 1–50 products, packing list → the file;
      - insurance → cargo value; ready date ≥ Cairo today;
      - China: site per source, method per add method, products 1–10, name or URL, colour /
        size totals = quantity, HTTPS cart link, shipping method per source, "other" country →
        typed city.
    - The demo bugs are fixed and tested.
    - Numbers accept Arabic / Persian digits and "٫".
    - `collectAttachments` (upload id → slot, product position), `deriveOrderValues` (CBM,
      air volumetric, totals: never from the client), `cairoToday`.
    - Portal `ORDER_STATUSES` gains `under_review` (badge + label, mock timeline).
  - `…000006_orders.sql`:
    - enums;
    - `orders`: reference `MG` + sequence from 1001; contact, client type, notes, accuracy
      time, form version; idempotency key + SHA-256 payload hash unique per customer;
    - `order_shipments`: every international / domestic field as a column; reference id + a
      separate "other" text; domestic regions and port and the air door addresses reuse the
      origin / destination columns;
    - container / truck groups; cargo items with CBM / volumetric stored;
    - China details, products, colour / size variants;
    - `order_status_history`;
    - `order_uploads` gains slot + `cargo_item_id`; FK from the ledger to orders;
    - RLS: owner read (not the key / hash), companies nothing.
    - `submit_order()` in ONE transaction:
      1. lock the balance row (concurrency + idempotency);
      2. same key → replay (or `IDEMPOTENCY_KEY_REUSED` with another hash);
      3. `NO_BALANCE`;
      4. all rows;
      5. attachments (own, unattached, the right purpose per slot, ≤ 20, no duplicates →
         `INVALID_ATTACHMENT`);
      6. ledger consume (`order:<id>`) + balance −1;
      7. status `under_review`;
      8. delete that service's draft.
    - Note: `jsonb_populate_record` turns missing keys into NULL (column defaults do not
      apply), so `toRows` always sends the NOT NULL booleans.
  - API:
    - `services/orderRows.ts` (pure): `toRows` / `fromRows` (rebuilds exactly the
      validated shape).
    - `services/orders.ts`:
      - reference checks: ports / airports / cities in the chosen country, Egyptian regions
        and port of discharge, types and lines exist, China delivery country;
      - canonical-JSON hash (sorted keys);
      - RPC errors → 409 NO_BALANCE / 422 IDEMPOTENCY_KEY_REUSED / 400; FK and check
        violations → 400;
      - `getOrder` rebuilds the order + derived values + attachment metadata (no paths, keys
        or hashes).
    - `POST /api/orders`: `requireCustomer`, 10 / h per user, a UUID `Idempotency-Key`
      header, the shared schema; 201, or 200 for a replay.
    - `GET /api/orders/:reference`: own orders only, else 404.
  - Web: `apiRequest` takes headers; `ordersApi.submitOrder(order, key)` /
    `getOrder(reference)`; the validation copy for every new message.
  - Tests:
    - shared `orders.test.ts` (20: every path + every rule + demo bugs + derived values);
    - backend `orders.test.ts` (12: auth, key, strict, reference checks, RPC arguments +
      canonical hash, status mapping, read-back, rate limit);
    - PGlite `pg/verify-b4.mjs` (12: drives the REAL schema + `toRows` / `fromRows`; every
      path round-trips exactly; replay; reused key; NO_BALANCE; attachment rollback; RLS;
      cascade);
    - totals: shared 121, backend 123, frontend 96, E2E 45.
  - Real backend (scratchpad `b4-real-check.mjs`, 9 checks, test data deleted):
    - one order per path (air with MSDS per product, sea FCL, land LTL with a packing list,
      domestic container, SHEIN screenshots); balance 5 → 0;
    - read-back by reference; another customer gets 404; the draft is removed on submit;
    - NO_BALANCE; a foreign file → 400;
    - **two parallel submits at balance 1 → one 201 + one 409**;
    - **a parallel double click with the same key → one order (201 + 200 replay), one
      deduction**;
    - a reused key → 422; RLS over PostgREST.
- **Phase B5 done (2026-11-23): the three forms** (`ff7b77e`).
  - `/app/new-request/:service` = `features/requests/RequestFormPage` (international 6 steps,
    domestic 6, China 4); `ServicePlaceholderPage` removed. `/app/new-request/success/:reference`
    is a minimal card until B6.
  - `useRequestWizard`: raw RHF values mirror the order. `pruneOrder` keeps only the chosen path,
    and `hiddenPaths` clears hidden values when a branch field changes. Validation =
    `orderIssues` (shared `orderSchemas`). The server draft is restored once (another form
    version is ignored) and autosaved 1 s after an edit (flushed on leave, never after submit).
    "Start over" deletes it. Submit keeps one `Idempotency-Key` per payload (reused on network
    retries). Balance 0 → Send disabled with the reason.
  - `lib/wizard.ts` (`useWizardSteps`, `useAutosave`, `focusFirstError`) is shared with the
    company wizard (plan B5 refactor). `FormSection` / `DraftRestoredNotice` moved to
    `components/`.
  - Steps: `steps/*`, field wrappers `components/fields.tsx` (`*` required / "(optional)"),
    review summary `summary.ts` (walks the pruned order: option labels, reference names, file
    names), copy in `i18n/portal/{ar,en}.json`.
  - **Bug fixed: "Next" skipped cross-field rules.** Zod runs a `superRefine` only when every
    field parsed, and the later steps are still empty. So "Next" let e.g. hazardous cargo
    without an MSDS through, and the error only came at the final submit. Shared now also
    exports `orderObjects` + `orderRules`. `orderIssues(service, order, step)` runs the rules
    itself when the step has no field errors: parts that parse are passed as parsed values, and
    a throw from a later, empty part is ignored. The server still uses `orderSchema` unchanged.
  - Tests: `test/requestModel.test.ts` (prune per path, hidden paths, `orderIssues` regression,
    summary), `test/portal/requestForms.test.tsx` (8: domestic LTL, zero balance, Back /
    branch clearing, draft restore + autosave, old draft version, China SHEIN, international sea
    FCL with MSDS + invoice). In jsdom, MSW does not answer an XHR upload, so that test stubs
    `ordersApi.uploadFile`. E2E `e2e/portalRequests.spec.ts`: the 3 forms submitted in AR + EN,
    desktop + 360 px, no overflow on any step, real XHR uploads. `mockPortalApi` now mocks the
    reference lists, drafts, uploads and orders, and returns its state. The portal projects match
    `/portal\w*\.spec/`.
  - Totals: shared 121, backend 123, frontend 115, E2E 57.
  - Not done here: the real-backend run of every path (B7).
- B5 committed as `ff7b77e`.
- **Phase B6 done (2026-11-23): success screen + print + PDF** (`3db811f`).
  - `/app/new-request/success/:reference` (`features/requests/RequestSuccessPage`) reads
    `GET /api/orders/:reference` (`useOrderRecord`, no retry on 404), so a reload or a shared
    link works.
    - The card shows: logo, title, the spec message (China: "within 24 working hours"), the
      reference, service, date + time (`useDateFormat`), status badge, balance "2 of 5"
      (`/me/summary`), and "View my orders".
    - 404 → "This request was not found" (also for another customer's order).
  - **Print:** `window.print()`. The portal shell (sidebar, top bar, bottom nav) is
    `print:hidden!` and the buttons are outside the card, so the card alone prints on one page.
    `[print-color-adjust:exact]` keeps the card's colours.
  - **PDF:** `lib/downloadPdf.ts` uses `html-to-image` + `jspdf` (installed, plan §5 item 36),
    both loaded on click.
    - The card is captured as the browser draws it (Arabic joining, RTL, Cairo checked
      visually), as a 2× JPEG on the card's computed background without shadow/radius, centred
      on A4. About 80–100 kB; a PNG was 5.5 MB.
    - jsPDF's optional `html2canvas` / `purify` chunks are built but never loaded (we don't
      call `.html()`). Main chunk +0.2 kB.
  - **Bug fixed (mock preview):** MSW's mocked `GET /orders/:id` (My Orders) also caught the real
    `/orders/MG1001`, so with `VITE_USE_MOCKS=true` the success page said "not found". References
    matching `ORDER_REFERENCE_PATTERN` now pass through (`passthrough()`). The unit harness does
    the same.
  - MW_002's unused `RequestSuccessModal`, its test and the `portal.success.*` copy were removed.
  - Tests:
    - `test/portal/requestSuccess.test.tsx` (4: direct open, China message, 404, Print / PDF /
      PDF error);
    - E2E (international flow, AR + EN, desktop + 360 px): reload keeps the card; print media
      hides the shell and buttons; `page.pdf()` = exactly 1 page; Download PDF = a real `%PDF`
      file named `MirhalGo-MG1001.pdf`. The files are kept in `test-results/` for a visual check.
  - Totals: shared 121, backend 123, frontend 117, E2E 57.
- B6 committed as `3db811f`.
- **Phase B7 (2026-11-23): real run + docs done; the deployed preview is still open**
  (committed as `bdeb058`).
  - **Real run through the UI, 14/14** (headless Chromium → `npm run dev:web` with mocks on, like
    the preview → local API → `mirhalgo_v1`). Script in the scratchpad (`b7-real-check.mjs`); run
    a copy placed in `frontend/` (`node --env-file=../backend/.env .b7.mjs`) and delete it.
    Cleanup always runs, even after a crash; test data deleted.
    - All 8 form paths with DB checks after each submit. Balance 8 → 0, 8 consumptions.
    - PDF download, another customer → "not found".
    - Draft on a second device with its file, "Start over" removes both.
    - Two tabs at balance 1 → one order + "no requests left".
    - Orphan cleanup.
    - The script logs in through the UI once. Other "devices" get a Supabase session written to
      `localStorage` (repeated UI logins hit the 10 / 15 min limit).
    - Stopping the `dev:api` task leaves its `node` child on :4000: stop it by PID.
  - **Bug fixed (found by the real run):** a min-1 list shown again (container / truck groups,
    loose items, products, colours / sizes) got 2 empty rows in development. React StrictMode ran
    the "append one row" effect twice, and both runs read the stale `fields`. Production was not
    affected. Now `useRepeatable` (`features/requests/formContext.ts`) checks the live form value.
    The test harness `renderPortal` now renders in `StrictMode` like `main.tsx`. Regression test:
    FCL → LCL → FCL leaves exactly one group; it fails without the fix.
  - Noted, not changed: "Next" during an upload shows "required" for that file until the upload
    ends. "X of 5" is a fixed total (spec), so it would be wrong after extra grants.
  - Docs: `docs/MW_003-PR.md` (changes, assumptions 25–29 + plan defaults, differences from the
    plan, MW_002 conflicts, tests, real run, bugs, open items, demo video notes). README: MW_003
    summary, `order-attachments`, cleanup schedule, reference data / placeholders, New Request
    always real with mocks on, security.
  - Totals: shared 121, backend 123, frontend 118, E2E 57.
  - **Still open in B7:** the deployed preview (needs the developer's Render + static-host
    accounts) and Lighthouse there.
- **Fix (2026-11-23, after B7): A3 "Back to home" asked on an empty form in development**
  (reported by the developer; committed as `cdb3ae9`).
  - Production was fine, which is why the E2E passed.
  - Cause 1: under React StrictMode, react-hook-form's form-level `formState.isDirty` turned
    true right after mount while `dirtyFields` was empty and every value equal to its default.
    So the leave dialog opened on an empty form on both sign-up pages.
  - Fix: `hasChanges(formState.dirtyFields)` (`lib/forms.ts`) decides "the form has data"
    for every leave guard and the Profile Save button: customer sign-up, company sign-up, the
    New Request forms, Account › Profile. **Don't use `isDirty` for this.**
  - Cause 2 (customer sign-up): `gender` / `acceptTerms` had no default, so after any edit
    they counted as changed against `undefined`, and "typed then cleared" still asked. They now
    default to `''` / `false`; the schema messages are unchanged.
  - Copy unchanged. Company: "Leave the form? Your draft is saved on this device for 7 days…"
    (the spec text plus what is not saved). Customer: "…The information you entered will be
    lost." (no draft there, plan §5 item 6).
  - Checked on the dev server (scratchpad `a3-probe.mjs`): AR / EN × 1280 / 360 px × both
    pages. Empty → home; with data → dialog; Stay stays; typed + cleared → home; Leave → home
    with the company draft kept; a restored draft asks.
  - Tests: `signupCustomer.test.tsx` and `companyRegistration.test.tsx` now render in
    `StrictMode` (+3 tests: typed and cleared ×2, restored draft asks). New
    `test/forms.test.ts` covers `hasChanges`. The empty and cleared-form tests fail on the old
    code.
  - Totals: shared 121, backend 123, frontend 123, E2E 57.
- **Navigation + "Back" button across the site (2026-11-23). ADDITION BEYOND THE MW_003
  SPEC**, requested by the developer in two steps (`ffeb451`).
  - **`components/ui/BackButton`** (no props but `className`): arrow + "رجوع" / "Back", ghost
    button (44 px, global focus ring), aria-label "رجوع إلى الصفحة السابقة" / "Back to the
    previous page" (contains the visible word). Arrow: `ArrowLeft` + `rtl:rotate-180`.
    - **History:** when `hasInAppHistory()` (`lib/navigation.ts`: React Router's
      `history.state.idx > 0`; never `document.referrer`), it calls `navigate(-1)`. That gives
      the exact URL + query; `ScrollRestoration` restores the scroll.
    - **Fallback:** otherwise `navigate(backFallback(pathname, viewer), { replace: true })`.
      `backFallback` (`features/auth/roles.ts`, next to `homePath`) is the page / parent map:
      - guest (or pending verification) → `/`;
      - customer: `/app/orders/:id` → `/app/orders`, `/app/companies/:id` →
        `/app/companies`, `/app/support/tickets/:id` → `/app/support`,
        `/app/account/:section` → `/app/account`, anything else → `/app/new-request`;
      - company → `/application-status` (from that page itself → `/`).
      - It never returns a page the viewer's role / auth state can't open.
    - It reads `AuthContext` null-safely (outside the provider = guest). While the session is
      still loading and there is no in-app history, it is **disabled**. Before this, a company
      clicking Back on the 404 page before the session loaded was sent to the landing page.
    - Unsaved data: the page's `useUnsavedChangesGuard` (`useBlocker`) also blocks the POP
      navigation and shows its dialog. No extra code.
  - **Shown** under the header / at the top of the content:
    - `SimpleLayout` / `AuthCard` `back` flag: login, sign-up role, customer + company
      sign-up (A3 "Back to home" kept), verify-email, forgot-password, application-status, 404.
    - Portal: order details, company profile, ticket, notifications, Account section (mobile
      only, `md:hidden`).
    - **Not** on: the landing page; the sidebar / bottom-nav pages (New Request, My Orders,
      Companies, Account, Help & Support); the request forms ("Back to services" + step Back
      kept); the order success page; "Application submitted".
    - The old per-page links ("Back to My Orders"…) and their keys were removed, with the dead
      `portal.newRequest.back` / `placeholder`.
  - **No loops / re-submits (`replace`):**
    - customer sign-up → verify-email; company registration → verify-email; unverified login →
      verify-email; order submit → success screen;
    - already `replace`: login → home, verify → home / submitted, reset → login, every guard,
      `/app`, `/dashboard`.
    - Back from the portal never reaches `/login`, and Back from a success screen never reaches
      the submitted form.
  - **List state in the URL** (`lib/useUrlState.ts`, writes with `replace`, defaults not
    written):
    - `useQueryParam(key, default, allowed)` and `useQuerySearch(key)` (typing is local and
      debounced into the URL; a URL change from elsewhere fills the box);
    - My Orders: `tab`, `sort`, `search`; Companies: `search`, `category`, `sort`;
      Notifications: `filter`; Help & Support: FAQ `q` (the tickets list has no filters);
    - loaded "load more" pages come back from the TanStack cache (5 min).
  - Copy: `common.back`, `common.backLabel`.
  - Tests:
    - `test/backButton.test.tsx` (12): browser router + StrictMode; history back keeps the
      query; fallback REPLACE; fallback per role / auth (guest, customer, company, status page);
      disabled while the session loads; Stay / Leave; name / arrow / focus; the
      `backFallback` map.
    - E2E (desktop + 360 px):
      - auth: Back on auth pages (AR placement, no overflow); landing → login → portal → browser
        Back = landing, not login; a company opening `/app/orders/…` → status page → Back
        never reaches a customer page; 404 → `/application-status` (RTL);
      - portal: list → detail → back; 4 pages opened directly → parent; none on sidebar pages;
        Account mobile only; My Orders tab + sort + search → details → Back restores all three
        (EN + AR);
      - requests: submit → success → browser Back = service list, not the form.
    - E2E mocks: `accessToken(role)`, `seedSession(page, role)`, `mockSupabase(page, role)`
      (default customer; `seedCustomerSession` renamed).
    - Flaky under parallel load, also on the previous commit: the redirect checks (`/verify-email`
      → `/login`, company → status) need more than the default 5 s while lazy chunks and the
      session load. They now wait 15 s.
  - Totals: shared 121, backend 123, frontend 135, E2E 71.
  - **Type-check note:** `npx tsc --noEmit -p .` in `frontend/` checks nothing (the root
    tsconfig only has references). Use `npx tsc -b` (what `npm run build` runs).

## 16. MW_004: Company portal (frontend) + demo company login

**Spec:** `docs/MW_004.md` (copied from the developer's spec folder on 2026-11-24). The
`Company_vieww.html` demo it mentions is not available: the Team Lead confirmed the spec
describes every feature. **Plan:** `docs/MW_004-plan.md` (checklist, phases, reuse, conflicts,
open questions with defaults). **Branch:** `feature/mw-004` from `main`.
Status: **plan approved (2026-11-24, answers in the plan). In progress.**

**Scope**

- **Part A (real backend):**
  - one `/login`; the login response and a new `GET /api/me` return `role` + `companyStatus`;
  - routing by role and status: customer → `/app/new-request`, approved company →
    `/company/overview`, other company statuses → `/company/application-status` (moved from
    `/application-status`, old URL redirects);
  - cross-portal guards;
  - a demo company seed script.
- **Part B (frontend only, MSW):** `/company/*` portal with 6 sections (overview, available
  requests, our offers, competitor offers, client inquiries, settings), offer templates per
  shipping category, privacy filtering in the mock handlers, mock state persisted per account
  in `localStorage`, "Reset demo data" (dev / staging only).

**Rules to keep in mind**

- **Git: commit locally after each phase. Do NOT push to GitHub and do NOT open a PR until the
  developer says so** (they push everything at the end).
- **The seed script must NOT be run against `mirhalgo_v1` until the developer confirms**
  (it is the only Supabase project). `DEMO_COMPANY_PASSWORD` comes from `backend/.env`: never
  printed, never committed.
- Privacy is enforced in the mock API, not the UI: no client contact fields, anonymised
  competitors, hidden-offer companies counted only.
- Reuse the customer portal's design system, layout and UI kit; `tokens.css` only; all copy in
  i18n (formal MSA). No new libraries are planned. Any new category colour tokens need approval
  (plan §6 Q8).
- Conflicts with earlier work (plan §5):
  - `homePath` / `backFallback` become status-aware;
  - Back on every company section except Overview (the customer portal is unchanged);
  - shared portal shell pieces are extracted from `PortalLayout`;
  - the MSW `GET /me` mock must not shadow the real `GET /api/me`.

**Progress**

- **Phase A1 done (2026-11-24, `cfff2d2`).**
  - The login response returns `companyStatus` next to `role` (`null` for customers and admins,
    and for a company without an application row).
  - `GET /api/me` (any role, `requireAuthenticated`) returns
    `{ id, role, emailVerified, companyStatus }`.
  - `requireAuth.ts` has one `authenticate(allow?)`; `requireRole`, `requireCustomer` and
    `requireAuthenticated` are built on it.
  - `getCompanyStatus` / `companyStatusFor` live in `services/companies.ts`.
  - Shared types `CompanyStatus` and `MeResponse`. Backend tests 131.
- **Phase A2 done (2026-11-24): routing by role and status.**
  - `AuthProvider` holds `companyStatus` for company sessions only:
    - from the login response (`signIn(tokens, companyStatus)`);
    - else from `GET /api/me`, once per account;
    - `loading` stays true until it is known;
    - an unreachable API means "unknown", which routes to the status page, never the portal.
  - `homePath(role, companyStatus)`: customer → `/app/new-request`; approved company →
    `/company/overview` (`COMPANY_PORTAL_HOME`); other or unknown status →
    `/company/application-status` (`COMPANY_STATUS_PAGE`).
  - Guards: `ProtectedRoute allow` sends the wrong role to its own home.
    `CompanyStatusRoute approved | approved={false}` splits the company routes. The old
    `/application-status` redirects.
  - `ApplicationStatusPage` moved to `features/companyPortal/pages/`.
  - The 6 sections point to `CompanyPortalPlaceholder` until Part B.
  - `backFallback` uses the company status, via `Viewer.companyStatus`.
  - **Mock conflict fixed:** the mocked customer avatar read moved from `GET /me` to
    `GET /me/avatar`, so MSW never shadows the real `GET /api/me`.
  - Tests: `guards.test.tsx` (every role × status × portal URL), `backButton.test.tsx`
    (company fallbacks), new `authCompanyStatus.test.tsx` (stored session waits for
    `/api/me`, customers never call it, API down, login passes the status).
  - E2E: `loginAs(role, status)`, `meAs(role, status)`, and `mockSupabase(page, role, status)`
    returning the application row. New flows:
    - an approved company logs in from `/login` → Overview, bounces from customer / status
      URLs, logs out;
    - pending / changes-requested / rejected companies land on the status page;
    - a customer opening `/company/*` lands on New Request.
  - The long international E2E got `test.slow()`: it timed out under the full parallel run.
  - Totals: shared 121, backend 131, frontend 149, E2E 81.
  - Committed locally as `3b8e3e7` (tested manually by the developer).
- **Phase A3 done (2026-11-24): demo company seed script. Written and tested, NOT run against
  `mirhalgo_v1`** (waiting for the developer's OK).
  - `backend/src/services/demoCompany.ts` + `scripts/seedDemoCompany.ts` →
    `npm run seed:demo-company -w backend` (from `dist/`, so build first).
  - It uses the same code as a real company sign-up:
    - `companyRegistrationSchema` (password policy, phone, EG legal-number rules);
    - two placeholder PDFs through `prepareFiles`;
    - `createRegistration` → the RPC (now exported from `services/companies.ts`);
    - then `confirmEmail` and `transition_application_status` → `approved` (actor
      `system`, note "demo seed (MW_004)");
    - no email is sent.
  - The Arabic demo data lives in `backend/src/seed/demoCompany.json`: no Arabic is allowed in
    backend code, and the file is covered by the `arabicCopy` deny-list.
  - The alias "الناقل الذهبي" has no DB column; it lives in the Part B mock identity (plan Q4).
  - Safety:
    - without `--yes` it is a dry run that never reads or writes the DB;
    - it prints the project ref;
    - `NODE_ENV=production` is refused unless `--allow-production`;
    - an existing demo account is only re-approved; the password changes only with
      `--reset-password`;
    - another account on that email (a customer, or a company with other legal numbers) is
      never touched;
    - a failure after the user is created deletes the user and its files;
    - `--remove` deletes only the demo company;
    - output shows the masked email only, never the password.
  - Env: `DEMO_COMPANY_PASSWORD` (required to seed), optional `DEMO_COMPANY_EMAIL` /
    `_PHONE` / `_CR` / `_TAX` (in `.env.example`, empty). Defaults:
    `demo.company@mirhalgo.com`, `+201000000001`, `9990000001`, `999000001`.
  - Tests: `backend/test/demoCompany.test.ts` (15). Also checked offline: the built script's
    dry run and its error exits, with fake env, no `.env` and a non-existent project.
  - README: "Demo company account (MW_004)" under Supabase setup.

**Open items (MW_004)**

- **Flaky E2E, investigate later:** `e2e/auth.spec.ts` "customer sign up → OTP → logged in →
  customer portal → logout" (desktop) failed once with a `toBeVisible` timeout during a full
  parallel run on 2026-11-24, then passed 6 of 6 times alone and in the next full run (1 failure in
  7 runs). Probably a 5 s default wait under load (lazy chunks + session), like the redirect checks
  fixed in MW_003.
- **Load-related unit test flakiness (fixed in A3):** in `test/portal/requestForms.test.tsx` two
  tests failed every time in the full parallel run, and passed 3 of 3 times alone. The first step
  waits for the lazy form chunk, which took longer than `findBy`'s 1 s default. `stepIs` now
  waits 5 s, and the describe block has a 20 s timeout. If another test flakes only in the full
  run, check its waits first.
