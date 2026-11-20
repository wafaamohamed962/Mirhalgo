# CLAUDE.md — MirhalGo

Context for Claude Code. Read this first in every session.

## 1. Project

**MirhalGo** (مرحال جو) is a shipping marketplace built in Egypt. A customer submits one
shipping request and receives price quotes from verified shipping / customs-clearance
companies.

**Current task: MW_001**: Landing page + Customer Sign Up (email OTP) + Login +
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
apps/web/src/
  app/               router, providers (Query, Auth, i18n)
  components/ui/     Button, Input, PasswordInput, PhoneInput, OtpInput, Select, Checkbox, Card, Badge, Toast
  components/layout/ Navbar, MobileDrawer, Footer, Container, Section, ScrollToTop, LanguageSwitch
  sections/          Hero, About, Services, Contact
  features/auth/     pages, hooks (useAuth), api calls, guards
  lib/               apiClient, supabase client, utils
  i18n/              ar.json, en.json
  styles/            tokens.css, globals.css
  assets/images/     optimized AVIF/WebP + srcset sizes (logo SVGs in assets/images/logo/)
apps/api/src/        routes/, services/ (otp, mail), middleware/, schemas/
packages/shared/     Zod schemas + types shared by web & api  (package name: @mirhalgo/shared)
supabase/migrations/
docs/                MW_001.md (spec), image-credits.md
```

npm workspaces monorepo: `apps/*`, `packages/*`.

## 4. Commands

```bash
npm install
npm run build -w packages/shared   # REQUIRED before running web/api, and after editing shared
npm run dev:api                    # http://localhost:4000/api/health
npm run dev:web                    # http://localhost:5173
npm run build                      # shared → api → web
npm run lint                       # ESLint (web) + tsc --noEmit (api)
npm run format                     # Prettier
npm test                           # Vitest: shared + api + web
npm run test:e2e -w apps/web       # Playwright (first: npx playwright install chromium)
npm run images -w apps/web         # regenerate AVIF/WebP after changing a photo (sharp)
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

- **All tokens live in `apps/web/src/styles/tokens.css`.** It is the ONLY file allowed to
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
- **All UI text comes from `i18n/ar.json` and `i18n/en.json`.** No hard-coded strings.
  Format numbers and dates per locale.
- Every input: label, error message, `aria-invalid`, `aria-describedby`.
- Every async action: loading, success and error states, and prevent double submit.
- Forms: React Hook Form + Zod schemas imported from `@mirhalgo/shared`. **The same schema
  is used on the server.**
- API responses are always `{ ok: true, data }` or `{ ok: false, error: { code, message } }`
  (types `ApiResponse` / `ApiSuccess` / `ApiError` in `packages/shared/src/index.ts`).
  Error codes are UPPER_SNAKE_CASE and i18n-ready.
- API errors: throw `HttpError(status, code, message)` from
  `apps/api/src/middleware/errorHandler.ts`. The global handler never leaks stack traces.
- External links: `target="_blank" rel="noopener noreferrer"`.
- Images: commercial-use licensed, 4K source, AVIF/WebP with `srcset` 640/1280/1920/3840,
  lazy-load below the hero, preload the hero image. Record every image in
  `docs/image-credits.md`.

## 8. Code quality standards (apply to EVERY feature, fix and change)

Priorities: **Clean Code + High Performance + Readability + Maintainability + Reliability.**

1. **Clean Code**: readable, simple, well-structured code with meaningful names.
2. **DRY**: no duplicated logic. Shared rules go in `packages/shared`, shared UI in
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
  (helmet, CORS and the body limit are already done in `apps/api/src/index.ts`.)
- **No user enumeration** on login, signup and forgot password. Login error is always
  "Invalid email/phone or password". Forgot password always answers "If an account exists,
  we sent a code".
- Escape all user content placed in emails.
- Log auth events (signup, login success/fail, OTP sent/failed, password reset) with
  timestamp + IP. **Never log passwords or OTP codes.**
- Schema changes only through **Supabase migrations** in `supabase/migrations/`, never
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

- `apps/web/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
- `apps/api/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`,
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
- Logo: the official PNG was vectorised into 4 SVGs in `apps/web/src/assets/images/logo/`:
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
  `ErrorCode` union in `packages/shared/src/api.ts`, translated as `errors.<CODE>`.

## 12. Status

**Done**

- Monorepo structure (spec 8.3), workspaces, Prettier, ESLint, Husky hook.
- Design tokens + Tailwind theme mapping + base styles (RTL default, fonts, focus ring,
  reduced motion, smooth scroll with `scroll-padding-top`).
- API skeleton: `GET /api/health`, helmet, CORS allowlist, 10kb JSON limit, 404 handler,
  global error handler. Verified responses: 200 / 403 CORS / 404 / 413.
- Shared API response types.
- Logo SVGs + favicon, `.env.example`, `docs/image-credits.md`.
- **Step 1, shared schemas** (`packages/shared/src`): `api.ts` (response types, typed
  `ErrorCode`), `otp.ts` (OTP constants), `phone.ts` (countries, E.164 helpers),
  `password.ts` (rules + score for the strength meter), `schemas/fields.ts|auth.ts|contact.ts`.
  Vitest tests in `packages/shared/test` (`npm test -w packages/shared`). `sideEffects: false`
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
- **Step 6, migrations** (`supabase/migrations/2026112000000{1,2,3}_*.sql`): `profiles`
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
  types (keep in sync with migrations). Tests: `apps/api/test` (Vitest + supertest).
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
- **Step 9, tests + SEO**: web unit tests in `apps/web/test` (Vitest + RTL: i18n key parity,
  language switch, OtpInput, PasswordInput, PhoneInput, a11y wiring, guards). Playwright in
  `apps/web/e2e` (production build, API + Supabase mocked in `e2e/mocks.ts`; desktop + 360px
  mobile): landing, RTL/LTR, no horizontal overflow, nav scroll, drawer, social links, contact,
  signup → OTP → dashboard → reload → logout, phone login + generic errors, unverified login,
  6th attempt, forgot password, company, 404. SEO: `index.html` defaults + OG, per-page meta,
  `public/robots.txt`, `public/sitemap.xml` (placeholder domain), SPA fallbacks
  (`public/_redirects`, `vercel.json`). Section links use `SectionLink` (JS scroll +
  replaceState): native hash jumps trigger a router POP whose scroll restoration cancels the
  smooth scroll. Navbar offset = each section's `scroll-margin-top` only.
- **Step 10**: README (setup, env, Supabase, run, tests, deploy, images).
- **Fix: missing web env no longer blocks navigation.** Without `apps/web/.env`, supabase-js
  threw "supabaseUrl is required" inside the lazily loaded client, AuthProvider never left
  `loading`, and every guarded page (Sign Up, Login, service cards) spun forever. Now
  `lib/env.ts` checks the `VITE_*` values (one console message naming the missing ones),
  AuthProvider always finishes loading, `apiPost`/supabase throw `ConfigError` →
  `errors.CONFIG_MISSING` (translated), and `ServiceNotice` shows it on auth pages and the
  contact form. Regression test: `apps/web/test/missing-env.test.tsx`.
- **Task 2, real backend connected (2026-11-20)**: `apps/web/.env` + `apps/api/.env` exist
  (git-ignored; `OTP_PEPPER` generated, rotated once after being pasted in chat). Migrations
  pushed to `mirhalgo_v1` (`npx supabase migration list --remote` = 3/3). Verified on the real
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
  exports stop at 1920). `npm run images -w apps/web` (`scripts/optimize-images.mjs`, `sharp`
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
  (no array schemas, 10 kb body limit); upgrading to zod 4 is a separate migration.
- OTP email header uses a text wordmark: Gmail does not render SVG. A hosted PNG logo can
  replace it later.
- Screenshots 1, 2 and 3 referenced by the spec are not available yet.
