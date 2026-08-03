## Goal
Get the "Install app" prompt appearing on iPhone/Chrome, and get in-app notifications actually reaching admins.

---

## Part 1 — Notifications (verified findings)

What I checked in the database:
- Your account is an active member and **is** an admin, and there are 5 admins.
- The notifications table has only **6 rows, all "photo tag"** ones from 2 Aug. No approval/listing/event/sponsor notification has **ever** been created.
- A new member profile was created **today at 08:16**, which should have produced an "awaiting approval" notification for all 5 admins. It produced none.
- Nobody has any saved notification settings rows, so defaults (all on) apply — settings are not the cause.

Two concrete causes:

1. **Sign-up notification is skipped whenever the admin email fails.** In the sign-up handler the e-mail is sent first; if Resend errors, the function returns immediately and never reaches the in-app notification step.
2. **The fan-out helper swallows every error silently.** It writes notifications with the privileged backend key — the same key that has gone missing before on this project — and on any failure it just logs and returns "0 sent", so nothing surfaces anywhere.

### Fix
- Reorder sign-up: always create the in-app notification for admins, then attempt the e-mail; neither step can cancel the other.
- Keep fan-out non-blocking but make it honest: return the reason it sent nothing, and log recipient counts so failures are diagnosable instead of invisible.
- Confirm the backend service key is bound, then run a live end-to-end test (trigger a real fan-out and re-query the table) before calling it fixed.
- Add a small admin-only "Send me a test notification" action on the admin dashboard so this can be re-checked at any time without waiting for a real sign-up.

---

## Part 2 — Install prompt

Why it isn't showing:

- **Chrome incognito on PC:** Chrome deliberately disables app installation in incognito, so the install event never fires there. Not a bug — it must be tested in a normal window on the published site.
- **iPhone:** iOS never fires an install event at all; we rely on a Safari-only fallback banner. It is skipped for Chrome/Edge/Firefox on iOS, is hidden for 14 days once dismissed, and does not appear inside the Lovable preview frame.

### Fix
- Detect **any** iOS browser, not just Safari, and show matching wording (Safari: Share → Add to Home Screen; Chrome on iOS: Share → Add to Home Screen from its own menu).
- Show the "Install app" entry in the menu whenever the app isn't already installed, so it is always reachable even after the banner was snoozed.
- Add a short "How to install" panel (iPhone + Android + desktop steps, bilingual) opened from that menu entry, so there is always a working path.
- Leave the snooze behaviour for the automatic banner as-is.

---

## Technical notes
- Files: `src/lib/member-signup.functions.ts`, `src/lib/notify.server.ts`, `src/components/InstallPrompt.tsx`, `src/components/SiteLayout.tsx`, `src/i18n/dictionaries.ts`, plus a small test action in `src/routes/_authenticated/admin/index.tsx`.
- No schema changes, no changes to the service worker, manifest or `vite.config.ts`.
- Verification: query the notifications table after a live trigger; install prompt verified on the published URL (preview iframes suppress it).
