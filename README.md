# MirhalGo (مرحال جو)

Shipping marketplace built in Egypt. **Task MW_001:** landing page, customer sign up with
email OTP, login (email or phone), forgot password and a persistent session.
Spec: [`docs/MW_001.md`](docs/MW_001.md).

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
| `apps/api`            | Express 4 API: auth + contact endpoints, own email OTP, Nodemailer       |
| `packages/shared`     | Zod schemas + types used by **both** web and api (`@mirhalgo/shared`)    |
| `supabase/migrations` | Database schema + RLS (the only way to change the schema)                |
| `docs`                | Spec, image credits                                                      |

## Requirements

- Node.js 20+ and npm 10+
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

| Variable                 | Value                                                           |
| ------------------------ | --------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://wpcpxmwkihaismxbdxip.supabase.co`                      |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API keys → **anon / publishable** |
| `VITE_API_URL`           | `http://localhost:4000` (prod: the Render URL)                  |

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
no credentials. First run: `npx playwright install chromium`.

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

Environment: the three `VITE_*` variables (`VITE_API_URL` = the Render URL).

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
