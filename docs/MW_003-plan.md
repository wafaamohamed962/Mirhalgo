# MW_003 implementation plan

Spec: `docs/MW_003.md` (copied from the developer's spec folder on 2026-11-22).
Status: **approved by the developer on 2026-11-22 (decisions 25–29 in `CLAUDE.md` §15, pending Team Lead confirmation). Implementation started with A1.**
Everything from MW_001 / MW_002 still applies (design tokens, shared Zod on both sides, i18n,
RLS everywhere, migrations only, no new libraries without approval).

---

## 1. Branch

- **Proposed:** `feature/mw-003`, created from `feature/mw-002` (stacked PR; its base is
  `feature/mw-002` until MW_002 is merged, then it is rebased onto `main`).
- **Before branching:** `feature/mw-002` still has uncommitted work (MSA rewrite, decision 23,
  and the draft auto-restore, decision 24). Proposal: commit that on `feature/mw-002` first, as
  one commit "MW_002: MSA Arabic copy + company draft auto-restore". Then create
  `feature/mw-003` from it, so the MW_003 diff contains MW_003 only. The new files
  (`docs/MW_003.md`, this plan, the MW_003 section in `CLAUDE.md`) go into the first MW_003
  commit.
- One PR for MW_003, with one commit per phase below. The PR can be split into Part A and
  Part B if the Team Lead prefers.

---

## 2. Phases

Every phase ends with these checks:

- `npm run build`, `npm run lint` and `npm test` pass, plus the related E2E tests.
- A real-backend check for anything that touches Supabase, with test data deleted afterwards.
- An update to `CLAUDE.md` §15.

### Part A: fixes to previous work

**A1. Arabic MSA (audit, small).** Most of this was done in MW_002 (decision 23).

- Re-audit every Arabic string against the stricter MW_003 rules:
  - no colloquial words;
  - no English words written in Arabic letters;
  - the English term in brackets only for industry terms (FCL, LCL, MSDS, CBM, Incoterm, B/L).
- Add a small unit test that fails if `ar.json` / `portal/ar.json` contain a deny-list of
  colloquial or transliterated words (e.g. حاجة، عايز، إزاي، دلوقتي، كود، لوجو، إيميل، باسورد،
  عربيات), so new MW_003 strings stay clean.
- Deliverable: a clean audit, the test, and an `ar.json` ready for the native-speaker review.
  That review is a developer action before merge.

**A2. Company sign-up: country → region, labels, phone code, legal rules.**

- Migration:
  - reference tables `countries` and `regions`;
  - region ids use ISO 3166-2 (`EG-C`, `SA-01`, `AE-DU`);
  - seed EG (27 governorates), SA (13 regions) and AE (7 emirates);
  - `countries.company_signup` flag set for EG, SA and AE;
  - plus the company data migration described in §4.
- API: the start of `GET /api/reference/:list` (`countries`, `regions?country=`), cached.
  Part B extends it.
- Shared:
  - `COMPANY_COUNTRY_RULES` (per ISO: legal-number patterns, normalisation, region label key,
    dial code);
  - the account and legal step schemas become country-aware (`superRefine` on `country`).
- Web, Step 1: Country select, then a Region select that reloads and clears when the country
  changes. The region label is Governorate / Region / Emirate.
- Web, phone fields: the default dial code follows the country only while the phone field is
  still empty. A number the user already typed is never rewritten.
- Web, Step 2: domestic coverage lists the selected country's regions. "Countries served"
  excludes the selected country (before: always excluded Egypt).
- Web, Step 3: labels, hints, input mask (Egypt only) and validation follow the country.
- Tests: shared schema per country; wizard country switching; migration checks on PGlite and
  the real DB.

**A3. Back button.**

- "Back to home" in the header of `/signup/company` and `/signup/customer`.
- If the form has data, a `ConfirmDialog` asks before leaving. It reuses the existing
  `useBlocker` leave guard, so there is no second mechanism.
- Copy: see §5 item 6. Customer sign-up has no draft, so "your draft is saved" would be
  false there.
- Unit tests and E2E (desktop and 360 px).

### Part B: New Request (full stack)

**B1. Reference data + migrations.**

- Tables:
  - `cities` (country, ar/en name);
  - `ports` (UN/LOCODE, country, ar/en name, `is_egyptian` derived from the country);
  - `airports` (IATA, country, ar/en name);
  - `container_types`, `truck_types`, `shipping_lines`;
  - `transit_estimates` (source × method → min/max days);
  - plus `countries` columns `dial_code`, `china_delivery`, `sort`.
- Each table has `active` and `sort` columns. Public read under RLS, no client writes.
- Seeds come from migrations (see §5 items 22–30 for the sizes and lists).
- API: `GET /api/reference/:list`.
  - Lists: `countries`, `regions`, `cities`, `ports`, `airports`, `container-types`,
    `truck-types`, `shipping-lines`, `transit-estimates`.
  - Filters: `?country=` where it applies.
  - Caching: an in-memory cache in the API, plus `Cache-Control: public, max-age=3600` and an
    `ETag`.
- Web:
  - `useReference(list, filter)` with TanStack Query (`staleTime` 1 h).
  - A new UI-kit `Combobox` (built in-house, WAI-ARIA combobox/listbox pattern): searchable,
    keyboard support, RTL, optional flag, optional "Other" that reveals a text field. The value
    is `{ id } | { other: text }`, so the manual text is stored separately from the list id.
  - A `Flag` component.

**B2. Request balance + ledger + `GET /api/me/summary`.**

- `requireCustomer` middleware: Bearer token → Supabase `auth.getUser` (see §5 item 3). The role comes
  from `app_metadata`, and only customers are allowed.
- Migration:
  - `customer_balances` (one row per customer, `balance >= 0`);
  - `balance_ledger`, append-only, with columns `type`, `order_id`, `before`, `after`,
    `reason`, `actor_type`, `actor_id`, `created_at`, `unique_key UNIQUE`.
  - Ledger `type` values: `grant`, `consume`, `restore`, `reset`. Only `grant` and `consume`
    are used now; the rest are designed for the admin plan.
  - The balance table is changed only through the security-definer functions
    `grant_balance(...)` and `submit_order(...)`, executable by service_role only.
  - Customers can read their own balance and ledger. There are no client writes.
- Grant 5 on customer email verification, in the same place that sets `app_metadata.role`.
  It is idempotent through `unique_key = 'initial:<user_id>'`.
- Backfill: every verified customer gets 5, recorded as a ledger `grant` with the reason
  `initial_backfill` (see §5 item 15).
- `GET /api/me/summary` returns first name, gender, `{ remaining, total }` and the active
  drafts (`[{ service, updatedAt }]`).
- Web:
  - the welcome banner, balance card and draft banner read the real summary;
  - the MSW `/me/attempts` and `/requests/draft` handlers are removed (their calls pass
    through);
  - the banner shows one row per draft service.

**B3. Drafts + uploads.**

- Migration:
  - `order_drafts` (user, service, `payload jsonb` ≤ 64 KB, `form_version`, `updated_at`,
    `unique (user_id, service)`);
  - `order_uploads` (owner, purpose, storage path, original name, MIME, size, `draft_id`
    nullable, `order_id` nullable, `created_at`);
  - private bucket `order-attachments` (10 MB, allowed MIME list), with the same RESTRICTIVE
    storage policy as MW_002 (anon and authenticated denied).
- `GET/PUT/DELETE /api/orders/drafts/:service`.
  - PUT is a debounced autosave (about 1 s after the last edit; it reacts to edits only, same
    as decision 24).
  - PUT also syncs which uploads belong to the draft (it checks that they are owned by the user
    and unattached).
  - Limit: 60 per minute per user.
- `POST /api/uploads` (multipart, one file plus `purpose`) and `DELETE /api/uploads/:id`.
  - Limit: 60 per hour per user.
  - Magic bytes for PDF, JPG, PNG and WEBP (already in shared).
  - New hand-written checks:
    - ZIP container for DOCX/XLSX: central-directory entry `word/document.xml` or
      `xl/workbook.xml`, rejected if `vbaProject.bin` is present;
    - OLE2 for DOC/XLS;
    - CSV as UTF-8 text with no NUL bytes.
  - Images are re-encoded with sharp (EXIF/GPS removed), as in MW_002.
  - Limits: 10 MB per document, 5 MB per image, at most 20 files per draft/order and 10
    screenshots.
- Cleanup:
  - `cleanupOrphanUploads()` deletes uploads with no order and no draft that are older than
    24 h: storage object first, then the row.
  - It runs as `npm run cleanup:uploads -w backend` and on an in-process hourly timer (no
    library, protected by a Postgres advisory lock so only one instance runs it).
  - The same timer finally schedules the MW_002 company cleanup (decision 10). See §5 item 17.
- Web:
  - upload on pick, one progress bar per file (reuses `apiUpload` and `FileUpload`), remove
    calls DELETE;
  - draft load on form open, auto-restored with the same inline notice as decision 24.

**B4. Orders API (shared schemas, tables, atomic submit).**

- Shared `schemas/orders.ts`:
  - discriminated unions by `service` → `mode` → `type` (sea FCL/LCL, air, land container /
    FTL / LTL, domestic container / FTL / LTL, china shein/sites × link / manual / screenshots);
  - `.strict()` objects, so a field outside the selected path is rejected (400);
  - on the client, a `pruneHidden()` helper removes hidden values before validation and submit;
  - every numeric field runs through `toWesternDigits` (already in `fields.ts`), on the client
    and the server;
  - cross-field rules: colour and size quantities add up to the product quantity, MSDS required
    per hazardous item, cargo value required when insurance is selected, ready date ≥ today
    (Cairo date), door services require their addresses, clearance location required when the
    service includes clearance (also for sea, a demo bug);
  - the demo bugs are fixed in the schema: domestic route fields are required, the manual
    method needs 1–10 products, and "Domestic" is not an international operation type.
- Migration:
  - `orders` (reference from the `order_reference_seq` sequence → `MG1001`, …; customer,
    service, status, contact details, client type and business name, notes,
    `accuracy_confirmed_at`, `submitted_at`, `form_version`, `idempotency_key`,
    `payload_hash`);
  - `order_shipments` (1:1 for international/domestic: every field in spec B8 as a typed column,
    each list choice stored as reference id plus `*_other` text);
  - repeatable groups `order_container_groups`, `order_truck_groups`, `order_cargo_items`;
  - `order_china_details`, `order_china_products`, `order_china_product_variants`
    (colour/size, value, qty);
  - `order_attachments` (purpose, slot, optional `cargo_item_id` for MSDS per product);
  - `order_status_history` (status, time, actor, note);
  - enums for every fixed option list;
  - RLS: the owner can read; companies and anon have no access; no client writes.
- `submit_order(user, payload jsonb, upload_ids, idempotency_key, payload_hash)`, security
  definer, service_role only, all in **one transaction**:
  1. An existing order with the same `(customer_id, idempotency_key)` → return its reference
     and the ledger `after` value. If the hash differs → `IDEMPOTENCY_KEY_MISMATCH` (422).
  2. `SELECT … FOR UPDATE` on the balance row: balance 0 → `NO_BALANCE` (409). This lock also
     handles two tabs submitting at the same time.
  3. Insert the order and detail rows.
  4. Attach the uploads. They must be owned by the user, unattached, with the expected purpose,
     and there must be ≤ 20.
  5. Write the ledger `consume` row (`unique_key = 'order:<order_id>'`) and decrement the
     balance.
  6. Write the first status-history row and delete the draft.
- `POST /api/orders` validates with the shared schema, checks the `Idempotency-Key` header
  (UUID), and recalculates every derived value (CBM per item, total containers, air volumetric
  weight). Values sent by the client are ignored. Then it calls the RPC.
  - Limit: 10 per hour per user.
  - Body limit for the order and draft routes: 64 KB. The global 10 KB limit stays for
    everything else.
- `GET /api/orders/:reference` returns the user's own order, rebuilt from the structured rows
  (same shape as the submitted payload, plus the computed values and attachment metadata). It
  never returns a storage path.
- Links (cart link, product URLs) are validated as `http/https` only, never fetched by the
  server, and always rendered as text or as `rel="noopener noreferrer"` links.
- Tests:
  - shared schema per path;
  - supertest for validation, ownership, idempotency replay, NO_BALANCE and rate limits;
  - PGlite for the RPC: atomicity, rollback, ledger, and concurrent submits with two
    connections;
  - real-backend script for the same checks.

**B5. The three forms.**

- First, a refactor: the generic wizard logic is extracted from `CompanyRegistrationPage` into
  `lib/wizard` (current-step resolver, "Next" validates only the current step, Back keeps
  data, scroll to the first error, edit from Review, leave guard). The company wizard and the 3
  order forms then share it, so it is not duplicated.
- Shared order-form pieces:
  - `ContactStep` (prefilled from the real profile, editable; WhatsApp "same as phone" on by
    default, because the profile has no WhatsApp);
  - `ServicesStep`, `ReviewStep` (summary, Edit links, accuracy checkbox, balance notice);
  - repeatable groups (`useFieldArray`, min 1, live totals);
  - `AttachmentField` (purpose upload with progress);
  - `Combobox` fields;
  - measurement inputs (weight + unit, L × W × H cm, CBM and volumetric shown as information).
- `/app/new-request/international` (6 steps), `/domestic` (6 steps, fixed operation and mode,
  shipping only) and `/china` (4 steps). They replace `ServicePlaceholderPage`.
- "Back to services" asks first if the form has data. When the balance is 0, the forms can be
  opened and filled, but Submit is disabled and the reason is explained.
- Required fields are marked `*`, optional fields "(اختياري)" / "(optional)". Every new string
  goes into `ar.json` / `en.json` in MSA.
- Tests:
  - unit tests per form path (conditional fields cleared, the demo bugs, totals, digits);
  - E2E for every path in AR and EN, desktop and 360 px, and no horizontal overflow.

**B6. Success screen + print + PDF.**

- `/app/new-request/success/:reference` (refresh-safe; reads `GET /api/orders/:reference`).
- It shows the reference, service, date, the message (the China form has its own text), the
  updated balance, and "View my orders".
- Print: `window.print()` with a print stylesheet that prints only the confirmation card.
- Download PDF: the card is rendered to a PDF in the browser (see §3). That code is lazily
  loaded on click, in its own chunk.

**B7. Wrap-up.**

- Real-backend run of every form path, draft on a second browser profile (another "device"),
  zero-balance block with two tabs, orphan cleanup.
- README (new env/config, buckets, cleanup, reference data), `docs/MW_003-PR.md` (assumptions
  list), deployed preview, and notes for the demo video.

---

## 3. New libraries (need approval)

| Library                | Where            | Why                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jspdf`                | web (lazy chunk) | Builds the PDF file for "Download PDF".                                                                                                                                                                                                                                                                                                  |
| `html-to-image`        | web (lazy chunk) | Renders the confirmation card as the browser draws it, so Arabic shaping, RTL and the Cairo font are correct. PDF libraries that draw text themselves (jsPDF text, pdf-lib, pdfkit, react-pdf) have known problems with Arabic letter joining and bidi. Trade-off: the PDF text is an image (not selectable). Alternative in §5 item 36. |
| `flag-icons` (CSS+SVG) | web (combobox)   | Country flags. Windows does not render flag emoji (it shows "EG"), so emoji flags are not an option on our main dev platform. Only the flags that are shown get downloaded.                                                                                                                                                              |

Built in-house (no library):

- searchable select (`Combobox`);
- ZIP/OLE/CSV file checks;
- scheduling (timer + advisory lock + npm scripts);
- idempotency (DB columns, `crypto.randomUUID`);
- debounced autosave (`useDebouncedValue` exists);
- CBM and volumetric calculations;
- Arabic digits (`toWesternDigits` exists);
- print (CSS).

Nothing parses Excel, Word or CSV content.

---

## 4. Conflicts with MW_002 and the data migration

| MW_002                                                                                     | MW_003                                                        | Resolution                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal numbers: CR 1–10 digits, tax 9 digits, each globally unique (decisions 1, 14)        | Per-country rules (EG / SA CR + VAT / AE trade license + TRN) | Keep the columns (`commercial_register_number` = business registration number, `tax_number`). Replace the checks with a country-aware check. Uniqueness becomes `(country_code, number)`, keeping the MW_002 constraint names (`companies_commercial_register_number_key`, `companies_tax_number_key`; done in A2, so the API mapping is unchanged). Duplicates still return `COMPANY_ALREADY_REGISTERED` (decision 1). |
| `companies.governorate` = Postgres enum `egypt_governorate`                                | Country ISO code + region id, not free text                   | Add `country_code` (FK `countries`) and `region_id` (composite FK `(country_code, region_id)` → `regions`, so the region always belongs to the country). Backfill `country_code = 'EG'` and `region_id` from a fixed governorate → ISO 3166-2 mapping in the migration, then set NOT NULL and drop `governorate` and its index.                                                                                         |
| `company_services.domestic_governorates egypt_governorate[]` + `domestic_all_governorates` | Domestic coverage = regions of the selected country           | New join table `company_domestic_regions(company_id, region_id)` with an FK, backfilled with `unnest`. Rename the flag to `domestic_all_regions` (all regions of the company's country), then drop the array column. Drop the `egypt_governorate` type once nothing uses it.                                                                                                                                            |
| `create_company_registration(...)` RPC                                                     | New fields                                                    | Replace the function and drop the old signature in the same migration. Update `types/database.ts`.                                                                                                                                                                                                                                                                                                                      |
| "Countries served" = `COUNTRIES` without Egypt                                             | Company may be in SA/AE                                       | Exclude the selected country instead.                                                                                                                                                                                                                                                                                                                                                                                   |
| Draft prompt "Continue your application?" (spec), changed to auto-restore by decision 24   | A3: "draft autosave stays as specified"                       | Keep decision 24 (auto-restore + inline notice). The draft now also stores `country` and `region`; on restore, a region that does not belong to the country is dropped. Legal numbers are still never stored (decision 7). The order forms use the same auto-restore pattern for their server drafts. The B1 draft banner (Continue / Discard) is extra, on the services page.                                          |
| Leave dialog "Leave the registration?"                                                     | "Leave the form? Your draft is saved."                        | Use the MW_003 copy for the company form, worded so it does not promise more than the draft keeps (passwords, legal numbers and files are not saved). §5 item 6 covers the customer form.                                                                                                                                                                                                                               |
| Portal mocks `/me/attempts`, `/requests/draft`, order refs `MG-R-YYYY-NNNNNN`              | Real summary/drafts, refs `MG1029`                            | Remove those mock handlers. Mock fixtures switch to the `MG####` format. The mock `GET /orders/:id` passes through to the real API when the order is not in the mock DB (otherwise it would hide `GET /api/orders/:reference`).                                                                                                                                                                                         |
| Shared `GOVERNORATES` constant                                                             | Regions come from the DB                                      | Remove it from the company code. Keep it only where the mocked Account › Addresses still uses it, until that is connected.                                                                                                                                                                                                                                                                                              |

**Existing company data:** the real DB has no company accounts left (the MW_002 test data was
deleted). The migration still backfills safely, in one transaction, and fails loudly on an
unmapped value. It is checked first on PGlite with seeded MW_002-shaped rows, then
`npx supabase db push`, then a check on the real DB. MW_001 customers are not touched, except for
the balance backfill (§5 item 15).

---

## 5. Open questions and assumptions (proposed default in **bold**; "Decided (N)" = decision N in `CLAUDE.md` §15, every other default was accepted as decision 29)

Security (the spec says "don't guess": these need the Team Lead)

1. **legacy DOC/XLS (OLE2).** They can carry macros and cannot be told apart cheaply. **Accept
   them by signature, never open or parse them on the server, and serve them only as downloads
   (`Content-Disposition: attachment`).** Reject DOCX/XLSX that contain `vbaProject.bin`.
   **Decided (25): accepted, validated by magic bytes, never opened/parsed/executed.**
2. **CSV.** There are no magic bytes. **Accept only valid UTF-8 text with no NUL bytes.**
   Formula injection (`=`, `+`, `-`, `@`) only matters for a later admin export; it is noted
   for that plan. **Decided (25): accepted.**
3. **API authentication.** **Use `supabase.auth.getUser(token)` per request.** It needs no
   new secret and respects logout/revocation, and costs about one network call per request.
   Alternative: local JWT verification with the project JWKS (faster, needs asymmetric JWT keys
   enabled). **Decided (26): `auth.getUser`.**
4. **Images** are re-encoded with sharp (EXIF/GPS removed), like MW_002 decision 5. **Yes.**
5. **No virus scanning** (out of scope, as in MW_002). **Assumed.**

Product and copy

6. **leave dialog copy.**
   - Company: **"Leave the form? Your draft is saved (passwords, legal numbers and files are not
     saved)."**
   - Customer sign-up has no draft: **"Leave the form? The information you entered will be
     lost."**
7. **UAE trade license format.** **3–20 letters/digits/hyphens, saved in uppercase.** SA VAT
   and UAE TRN: **15 digits only** (the extra SA "starts and ends with 3" / AE "starts with 100"
   checks are off unless you want them). SA CR: 10 digits. EG unchanged (CR 1–10 digits, tax
   9 digits with mask). No input mask for SA/AE.
8. **Phone default code** changes with the country **only while the field is empty**.
9. **Selected companies (`?companies=`) from the MW_002 directory:** companies are still mocked,
   so their ids cannot be stored with a real order. **Hide the "selected companies" bar and
   "Send to all in category" behind a flag (code kept) until the directory is real.**
10. **Initial order status.** **A new `under_review` status** (admin review comes later), added
    to the shared `ORDER_STATUSES` and the timeline.
11. **No email on order submit** (not in the spec). **Assumed.**
12. **My Orders and Account › Requests balance stay mocked** (spec: out of scope). This means a
    real order does not appear in the mocked list, and the mocked balance history differs from
    the real card. **Accepted for this plan and noted for the demo.** Cheap alternative: point
    the Balance page at the real ledger with one extra endpoint.

Data and storage

13. **idempotency storage.** **Columns on `orders`:** `idempotency_key` (unique per
    customer) and `payload_hash` (SHA-256 of the canonical payload). There is no separate table
    and no expiry. The same key with a different payload → 422. The client creates the key on
    the first Submit click and reuses it for retries, until the payload changes.
14. **Reference number.** **`MG` + a sequence starting at 1001** (no year, no padding, as in the
    `MG1029` example).
15. **balance for existing customers.** **Backfill 5 for every verified customer** (ledger
    `grant`, reason `initial_backfill`, actor `system`). Companies and unverified users get no
    balance row. "X of 5" uses `MAX_REQUEST_ATTEMPTS = 5` as the display total.
16. **draft lifetime.** The spec gives none. **Delete drafts (and their files) 30 days after
    the last save.**
17. **cleanup scheduling.** **Hourly in-process timer in the API plus npm scripts**, guarded
    by a Postgres advisory lock. It also schedules the MW_002 company cleanup (decision 10).
    Note: Render free instances sleep, so production should use a Render Cron Job or Supabase
    `pg_cron` + `pg_net` calling a secret-protected endpoint. To be decided at deploy.
    (`pg_cron` alone cannot delete Storage files.)
18. **Draft size.** **64 KB payload, ≤ 20 files per draft/order, ≤ 10 screenshots.** The body
    limit is raised to 64 KB only on the order and draft routes.
19. **Rate limits are in memory per user**, as today. This is correct for one API instance; more
    instances would need a shared store. **Assumed.**
20. **Cargo ready date "today or later"** uses the **Cairo date** (Africa/Cairo) on both client
    and server.
21. **Derived values** (CBM per item = L×W×H/1,000,000 × cartons, air volumetric weight =
    L×W×H/6000 × cartons, total containers/trucks) are **computed on the server and stored**.
    Client values are ignored. CBM is shown, not typed.

Reference data (seed sizes; the spec says "seeded from the current demo lists", but **we do not
have the demo**. Please send its lists if they should be used.)

22. **countries:** **all ISO 3166-1 countries (~249) with Arabic and English names**, flag
    from the ISO code, dial code. The phone input keeps its curated 15-country list (strict
    lengths) for now.
23. **regions:** **EG 27, SA 13, AE 7**, ISO 3166-2 ids.
24. **cities:** **main cities for the 8 China delivery countries (EG, SA, AE, KW, QA, BH,
    OM, JO) plus Libya, Sudan, Iraq, Lebanon and Türkiye (international land routes)**, about
    10–30 each. Any other country offers only "Other" with free text.
25. **ports:** **about 150 seaports by UN/LOCODE**: all Egyptian commercial ports
    (Alexandria, Dekheila, Damietta, Port Said East/West, Sokhna, Adabiya, Safaga, Abu Qir,
    Arish, …) and the Red Sea, Gulf and Mediterranean ports, plus the top world container ports.
    "Other" is always available.
26. **airports:** **about 150 cargo airports by IATA** (all Egyptian international
    airports, the Gulf/MENA airports, the main world cargo hubs). Data from OurAirports (public
    domain) and UN/LOCODE (free use), Arabic names written by us (part of the native review).
27. **container types:** **the 7 from the spec**: 20' Standard, 40' Standard, 40' HC,
    Reefer, Open Top, Flat Rack, Platform. They could be split by size (20'/40' Reefer, etc.) if
    the demo did that. **PLACEHOLDER (27).**
28. **truck types:** the spec says "13 types" without naming them. **Proposed:** box truck
    (جامبو), small pickup (ربع نقل), half truck (نصف نقل), 7 m box, 10 m box, flatbed trailer,
    side-wall trailer, curtain-side trailer, refrigerated truck, refrigerated trailer, tanker,
    lowbed, container chassis. **Decided (27): seeded as a PLACEHOLDER list, replaced from the demo later** (same for items 27 and 29).
29. **shipping lines:** **about 20 major carriers** by name only (Maersk, MSC, CMA CGM,
    COSCO, Hapag-Lloyd, ONE, Evergreen, HMM, Yang Ming, ZIM, PIL, Wan Hai, OOCL, Arkas, …) plus
    "Other". No logos. **PLACEHOLDER (27).**
30. **transit estimates:** a `transit_estimates` table: Chinese sites air 15–25 / sea 45–60
    days, SHEIN land 35–45. **SHEIN air is missing in the spec. Decided (28): 10–15 days, configurable.**
31. **Land clearance "border / location":** **free text (3–100)**. A seeded list of border
    crossings can come later.
32. **"Any airport"** is stored as a boolean next to the airport id. **Yes.**
33. **Shipment-document slots:** the upload `purpose` (packing_list, msds, invoice, document,
    screenshot) is the security class (allowed types). Each attachment also gets a **`slot`**
    (commercial_invoice, packing_list, draft_bl, other_document, cargo_packing_list, msds,
    msds_item, screenshot), so the spec's "commercial invoice / packing list / draft B/L /
    other" stay distinguishable.
34. **Currencies:** **USD / EUR / EGP** for both the target price and the cargo value.
35. **Draft vs form version:** the draft stores `form_version`. On a mismatch, **values that still
    parse are kept and the rest are dropped.**

PDF

36. **"Download PDF" approach.** **Client side: `html-to-image` + `jspdf`, lazily loaded.** The
    PDF looks exactly like the card in both languages, but its text is an image. Alternative:
    a server-side PDF (`pdfkit` + embedded Cairo font, selectable text). That needs Arabic
    shaping/bidi handling and careful checking, so it costs more effort and adds an API
    dependency. A third option is to drop the separate download and use the browser's
    "Save as PDF" from Print, with no library at all. That doesn't fully meet the spec's
    separate "Download PDF" button.

---

## 6. Out of scope (unchanged from the spec)

- Connecting My Orders / Companies / Account to the backend.
- Admin review and publishing.
- Company offers.
- Admin restore/reset of the balance (the ledger is designed for it).
- Payments.
- Emails on order submit (§5 item 11).
- Virus scanning.
