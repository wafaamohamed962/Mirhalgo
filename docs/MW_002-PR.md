# MW_002 PR notes (draft, paste into the PR description)

## Assumptions (pending Team Lead confirmation)

- Decisions 1–21 in `CLAUDE.md` §14 (made by the developer on 2026-11-21).
- **Decision 24 (2026-11-22): company registration draft is restored automatically.** This
  replaces the spec's "Continue your application?" prompt. On return the saved draft is
  restored, and a small inline notice (`role="status"`) says "We restored your saved progress."
  with a "Start over" link (clears the draft and resets the form) and a dismiss button.
  Autosave rules are unchanged: same fields, 7-day expiry, never passwords, legal numbers or
  files, cleared on submit and on logout.
- **Decision 23 (2026-11-22): Arabic copy is Modern Standard Arabic, not the spec's Egyptian
  colloquial wording.** All Arabic text (UI, portal, emails, SEO meta, mock data) was rewritten
  in simple, professional MSA with consistent terms (تسجيل الدخول، إنشاء حساب، كلمة المرور،
  البريد الإلكتروني، رقم الهاتف، رمز التحقق). The spec's Arabic marketing copy (hero, about,
  services, footer) was translated with the same meaning, e.g. "اشحن أي حاجة لأي مكان" →
  "اشحن أي شيء إلى أي مكان". i18n keys and English text are unchanged. RTL layouts were
  re-checked on desktop and 360 px mobile (every page, menus, dialogs, form errors).
- **Decision 22 (2026-11-22): the customer portal shows the user's real identity, not MSW.**
  First/last name, gender, email and phone come from the logged-in user's own `profiles` row
  (RLS owner select) through the service layer (`portalApi.getMe` / `updateProfile`, same `Me`
  shape, implemented in `frontend/src/services/api/ownProfile.ts`). This is used by the welcome
  banner, the top-bar avatar menu and Account › Profile.
  - Saving name/gender in Account › Profile updates the real row. RLS and column grants allow
    the owner to update only `first_name`, `last_name` and `gender` (checked on the real
    project: `role`, `email`, `phone` and `email_verified_at` are refused with 42501, and other
    users' rows can't be read or changed).
  - Email and phone are read-only. The mocked "Change email/phone" OTP flow is hidden until the
    real API supports it (code kept, `CONTACT_CHANGE_ENABLED` in `ProfileSection.tsx`).
  - The avatar image is still mocked; if it fails, initials are shown.
  - Everything else stays mocked (orders, offers, companies, notifications, tickets, attempts,
    addresses, sessions).
  - The TanStack Query cache is cleared when the signed-in user changes, so one user's identity
    can never be shown to the next user on the same browser.
