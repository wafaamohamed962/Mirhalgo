# MW_003 PR notes (draft, paste into the PR description)

Branch `feature/mw-003`, stacked on `feature/mw-002` (rebase onto `main` after MW_002 is
merged). Spec: [`MW_003.md`](MW_003.md) · plan: [`MW_003-plan.md`](MW_003-plan.md).

## What changed

**Part A, fixes**

- **A1 Arabic:** all Arabic copy is simple Modern Standard Arabic. A deny-list test
  (`frontend/test/arabicCopy.test.ts`) blocks colloquial and transliterated words, and Arabic
  hard-coded in code. Email copy moved to `backend/src/i18n/{ar,en}.json`.
- **A2 Company country → region:** company sign-up offers Egypt, Saudi Arabia and the UAE
  (from the DB), then a governorate / region / emirate (ISO 3166-2). The phone code, the
  legal-number labels / validation / mask, and the domestic coverage follow the country. Legal
  numbers are unique per country.
- **A3 "Back to home"** on both sign-up pages, with a confirmation when the form has data.

**Part B, New Request (full stack)**

| Piece          | What                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reference data | Countries, regions, cities, ports, airports, container / truck types, shipping lines, transit estimates. `GET /api/reference/:list` (cached 10 min + ETag). Searchable `Combobox` with flags and "Other".                      |
| Balance        | `customer_balances` + an append-only `balance_ledger`. 5 requests on verification, backfilled for existing customers. `GET /api/me/summary`.                                                                                   |
| Drafts         | One server draft per customer and service, autosaved (1 s debounce), restored on any device, deleted on submit or "Start over". Files are uploaded before submit (`POST /api/uploads`, private bucket `order-attachments`).    |
| Submit         | `POST /api/orders`: shared Zod schema, `Idempotency-Key`, one transaction (`submit_order`): balance lock, order rows, attachments, ledger, status, draft removed. `409 NO_BALANCE`. Derived values are computed on the server. |
| Forms          | International (6 steps), domestic (6), China (4). "Next" validates the current step only. Hidden values are cleared when a choice changes. Review with Edit links.                                                             |
| Success        | `/app/new-request/success/:reference` (reads `GET /api/orders/:reference`, so a reload works). Print (the card alone, one page) and Download PDF.                                                                              |
| Cleanup        | Hourly in-process job (single holder via a lease row): orphan uploads > 24 h, drafts > 30 days, unverified company applications > 7 days. Also `npm run cleanup -w backend`.                                                   |

## Assumptions (pending Team Lead confirmation)

Decisions 25–29 in `CLAUDE.md` §15 (made by the developer on 2026-11-22):

- **25 Files.** Uploads accept PDF, DOC/DOCX, XLS/XLSX, CSV, JPG, PNG and WEBP, as the spec
  lists them. Every file is checked by its **content** (magic bytes; DOCX/XLSX with
  `vbaProject.bin` = macros are refused; CSV = valid UTF-8 without NUL bytes). Files are
  **never opened, parsed or executed on the server**, only stored and served as downloads.
  Images are re-encoded with sharp (metadata removed). No virus scanning (out of scope).
- **26 API auth.** Every authenticated request calls `supabase.auth.getUser(token)`, so a
  session revoked after a password reset is refused at once (checked on the real project).
- **27 Placeholder lists.** Truck types (13), container types (7) and shipping lines (20) are
  starter lists marked `-- PLACEHOLDER` in the seed migration, because we do not have the demo.
  **Please send the demo lists.**
- **28 SHEIN air transit** = 10–15 days (not in the spec). Every estimate is a configurable row
  in `transit_estimates`.
- **29 Plan defaults** (plan §5). The ones worth a look:
  - Order reference `MG` + a sequence from **1001** (e.g. `MG1029`).
  - New orders start as **`under_review`** (admin review comes later).
  - **No email** on submit (not in the spec).
  - Drafts expire **30 days** after the last save.
  - Cargo ready date "today or later" uses the **Cairo date** on both sides.
  - Currencies **USD / EUR / EGP**.
  - Land clearance point is free text.
  - "X of 5" uses a fixed display total of 5 (spec wording).
  - The MW_002 "selected companies" bar and "Send to all in category" are **hidden** (code
    kept): companies are still mocked, so their ids can't be stored with a real order.
  - My Orders, Companies and Account › Balance **stay mocked**. A real order does not appear in
    the mocked My Orders list yet.
  - "Download PDF" is made in the browser (`html-to-image` + `jspdf`, loaded on click). The PDF
    looks exactly like the card in both languages, but its text is an image (not selectable).

**Differences from the plan**

- A draft saved by **another form version is ignored** (the form starts empty). Plan item 35
  said "keep the values that still parse". Ignoring is simpler and can never restore a value
  into the wrong field. Only a form change (version bump) triggers it.
- The cleanup lock is a **lease row** (`job_leases`) instead of a Postgres advisory lock:
  PostgREST cannot hold an advisory lock across calls.

## Conflicts with MW_002 (resolved)

- Legal numbers: unique per `(country_code, number)`, with the same constraint names, so a
  duplicate still returns `COMPANY_ALREADY_REGISTERED`.
- `companies.governorate` (enum) → `country_code` + `region_id`, backfilled. The migration
  fails loudly on an unmapped value.
- `domestic_governorates[]` → the join table `company_domestic_regions`.
- MW_002 decision 24 (auto-restore of the company draft) is kept. The same notice is used by
  the request forms.
- The mocks `/me/attempts` and `/requests/draft` were removed (real API now). Order references
  became `MG####`.

## Database

Migrations `backend/supabase/migrations/2026112200000{1..6}_*.sql`, pushed to `mirhalgo_v1` with
the developer's OK. RLS is on every new table: the owner reads their own rows, clients never
write. Storage paths, idempotency keys and payload hashes are hidden by column grants. Private
bucket `order-attachments` (10 MB, 9 MIME types) with a restrictive client-deny policy.

## How it was tested

- **Unit / integration:** shared 121, backend 123, frontend 118.
  - Every schema path and rule, including the demo bugs fixed.
  - API validation, ownership, idempotency replay, NO_BALANCE, rate limits.
  - The forms through the real page, in React StrictMode like the app.
- **PGlite** against the real migrations: atomic submit, rollback, ledger, concurrency, RLS.
- **E2E (Playwright, 57):** the 3 forms submitted in AR + EN, desktop + 360 px, no horizontal
  overflow on any step, real uploads, success page reload, print layout (exactly one printed
  page), real PDF download.
- **Real backend, through the UI** (2026-11-23, browser → local API → `mirhalgo_v1`, mocks on
  like the preview; 14/14; test data deleted):
  - every form path: international sea FCL (MSDS + invoice), air door-to-door (2 products, one
    hazardous, insurance), land LTL (customs only, packing list CSV), domestic container,
    domestic FTL (2 truck groups), China SHEIN cart link, China Alibaba (colours + sizes),
    China 1688 screenshots;
  - rows, attachments and ledger checked in the DB after each submit; balance 8 → 0;
  - PDF download; another customer's success link → "not found";
  - **draft on a second device** (another browser profile) restored with its uploaded file;
    "Start over" removed the draft and its file;
  - **two tabs at balance 1**, Send in both at once → one order, the other "no requests left";
  - orphan cleanup removed an unattached upload older than 24 h (file + row).

## Bugs found and fixed during MW_003 (worth knowing)

- "Next" skipped the cross-field rules while later steps were empty: hazardous cargo without an
  MSDS passed the step, and the error came only at the final submit.
- In development (React StrictMode), a list that is shown again (container groups, products,
  colours) got **two** empty rows instead of one. Production was not affected.
- With mocks on, the MSW My Orders handler caught the real `GET /orders/MG…`, so the success
  page said "not found" on the preview.
- Company draft: leaving within 500 ms of an edit lost the last edit, and a pending save could
  bring a draft back after "Start over" / submit.
- `SUPABASE_URL` ending in `/rest/v1/` broke every query (`PGRST125`). The API now refuses to
  start with a URL that has a path.

## Open items

- **Team Lead:** confirm decisions 25–29 and the earlier ones (1–24).
- **Demo lists** for truck types, container types and shipping lines (placeholders now).
- **Native-speaker review** of the Arabic copy (`docs/ar-review.md`, local only). The Arabic
  names of ports, airports and cities live in the DB and are not in that file yet.
- **Ports without a UN/LOCODE** (15 of 113) are stored with `unlocode = NULL` until checked.
- **Scheduling on Render free:** the instance sleeps, so the hourly cleanup only runs while it
  is awake. Add a Render Cron Job (`npm run cleanup -w backend`) or `pg_cron` + `pg_net` at
  deploy.
- **UX:** pressing "Next" while a file is still uploading shows "This field is required" for that
  file until the upload finishes. Possible follow-up: disable "Next" while an upload is in
  progress.
- **"X of 5":** the total is fixed at 5 (spec). Once admins can grant extra requests (the ledger
  supports it), the card should show the real total.
- Lighthouse mobile ≥ 90 to be measured on the deployed preview (it hangs locally).

## Demo video notes (AR + EN)

1. Company sign-up: choose Saudi Arabia → the region list, the +966 code and the CR / VAT labels
   change. "Back to home" asks first.
2. New Request: the balance card "5 of 5", then the international form, sea FCL. Show that
   "Next" checks only this step, the searchable port list with flags, and switching FCL → LCL
   clearing the container groups.
3. Upload an MSDS and an invoice (progress bar), leave the page, open it on another browser:
   "We restored your saved progress" with the files.
4. Review with Edit links → Send → success card `MG10xx`, Print, Download PDF (open it in
   Arabic).
5. China form: SHEIN cart link, the transit days, delivery country / city, and the China
   message on the success card.
6. At 0 requests left: the form opens, but Send is disabled with the reason.
