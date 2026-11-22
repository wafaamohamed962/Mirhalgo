# MW_002 PR notes (draft, paste into the PR description)

## Assumptions (pending Team Lead confirmation)

- Decisions 1–21 in `CLAUDE.md` §14 (made by the developer on 2026-11-21).
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
