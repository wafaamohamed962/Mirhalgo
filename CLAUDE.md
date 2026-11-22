# CLAUDE.md — MirhalGo

Context for Claude Code. Read this first in every session.

## 1. Project

**MirhalGo** (مرحال جو) is a shipping marketplace built in Egypt. A customer submits one
shipping request and receives price quotes from verified shipping / customs-clearance
companies.

**Current task: MW_003** (branch `feature/mw-003`, stacked on `feature/mw-002`; spec
`docs/MW_003.md`, plan `docs/MW_003-plan.md`, see §15): fixes (Arabic MSA, company country →
region, back button) + the full-stack New Request page. Builds on MW_001/MW_002 rules.

**Previous task: MW_002** (branch `feature/mw-002`, not merged yet; spec `docs/MW_002.md`, see
§14): Part A company registration (full stack) + Part B customer portal (frontend only, MSW
mocks). MW_002 builds on MW_001 and does not override its design system, stack, security or OTP
rules.

**Previous task: MW_001** (on `main`): Landing page + Customer Sign Up (email OTP) + Login +
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
    (New Request, service placeholder `/app/new-request/:service`, `RequestSuccessModal` ready
    for later), `orders/` (list with tabs/counts/search/sort/load more; details with Details ·
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
- Not committed yet: everything is on `feature/mw-002` as working-tree changes.

## 15. MW_003: Fixes + New Request page (full stack)

**Spec:** `docs/MW_003.md` (copied from the developer's spec folder on 2026-11-22).
**Plan:** `docs/MW_003-plan.md` (approved 2026-11-22 by the developer).
**Branch:** `feature/mw-003`, created from `feature/mw-002` (stacked PR; rebase onto `main`
after MW_002 is merged). The MW_002 decisions 23–24 work was committed first on `feature/mw-002`
(`6941628`).

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
accepted). `flag-icons` is still to be confirmed (needed from B1). Combobox, file checks,
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
- Next: Phase A3.
