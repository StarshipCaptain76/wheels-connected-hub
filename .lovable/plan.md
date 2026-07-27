
# Site-wide audit — findings & corrective plan

I walked every route, followed every `<Link>`, `<a href>`, `navigate()`, form submit, and OAuth flow. Below are the concrete gaps grouped by severity, then a fix plan.

## Gaps found

### Critical — user-facing action is broken or misleading

1. **`/contact` form does nothing.** `onSubmit` validates and shows a "sent" toast, but there is no server function call and no email is sent. The page text claims users can "message the committee" — false today.
2. **404 page (`__root.tsx` `NotFoundComponent`) drops the user out of the site.** No header, no nav, no language toggle, and it uses `bg-background`/`text-foreground` tokens that don't exist in this design system (renders as unstyled). Users hitting a bad URL cannot navigate back into the site.
3. **Google OAuth `redirect_uri: window.location.origin`.** After the provider redirect, the user lands on `/` (home), not `/members`. The `if (!result.redirected) navigate({ to: "/members" })` branch is skipped when Google performs a full redirect. Users successfully sign in but are dumped on the home page with no confirmation they're in.
4. **`/classifieds/$id` contact block is misleading for signed-in non-owners.** RLS only returns `contact` to the owner + admins, so a signed-in ordinary member sees the "Sign in to see the seller's contact details" CTA even though they're already signed in — and clicking Sign in bounces them right back after auth-redirect. Should say "Only the seller and admins can see contact details — reply via the club" or route to a members-only reveal.

### High — feature exists but has no path to reach it

5. **No admin navigation.** `/members` ("The Garage") has no links to `/admin/classifieds`, `/admin/shop`, `/admin/sponsors`, `/admin/newsletter`. Header nav omits them for everyone. Admins can only reach these by typing the URL.
6. **No gallery upload UI on-site.** Admin-only RLS is in place but no route lets an admin add/remove gallery items. The gallery is effectively empty unless someone uploads via a database tool.
7. **No events admin UI.** Same story — events come from the seed migration + Google Calendar only; there's no way to add a new club event through the app.

### Medium — link works but destination or flow is off

8. **Sign-up email confirmation redirect.** `emailRedirectTo: ${origin}/members` targets a protected route. If the auth-gate resolves before the session hydrates from the URL hash, the gate throws `redirect({ to: "/auth" })` and the user sees the sign-in form after clicking the confirmation link. Should redirect to `/auth?next=/members` or `/` and let the session listener route.
9. **Shop enquiry modal has no explicit close/confirmation UX.** After a successful send it stays open, no "close" button; users only see the backdrop-click hint. Success/error states aren't rendered visibly inside the modal.
10. **`/classifieds/new` back link always points to `/classifieds/mine`.** A first-time poster arriving from `/classifieds` sees "Back" send them to their (empty) listings page instead of the browse page they came from.
11. **`/classifieds/new` uses 1-hour signed URLs for photo previews.** If the user takes >60 min to finish the form, thumbnails 404 (upload still succeeds). Minor but visible.
12. **Mobile bottom nav overflows.** 9 items in `SiteLayout` mobile bar wrap awkwardly on 375-wide phones (Home/Events/Gallery/Classifieds/Shop/Sponsors/About/Join/Contact). Needs a compact set + "More" or a hamburger.
13. **Auth "Reset sent" info text stays after switching mode.** Cosmetic — old `info` doesn't clear on all mode transitions.

### Low — visible copy vs behaviour

14. **`__root.tsx` "Try again" button uses `<a href="/">`** — full page reload instead of client nav. Minor.
15. **`NotFoundComponent`** — cannot cleanly use `<Link>` inside the pathless root fallback and be theme-consistent; wrap in `SiteLayout` and switch to `bg-paper`/`text-ink`.
16. **`sitemap.xml`** correctly lists all public routes and approved classifieds. No gap.
17. **PWA + reset-password + newsletter unsubscribe + sponsor apply + merch enquiry (Resend)** were manually traced — endpoints, redirects, and success paths are correct.

## Corrective plan (phased, smallest→largest)

### Phase A — Fix broken actions (must-do)

- **A1. Wire `/contact` to Resend.** Add `sendContactMessage` server fn in `src/lib/contact.functions.ts` that emails `admin@justwheels.co.za` from `contact@notify.justwheels.co.za` with the sender's name/email/message. Update `src/routes/contact.tsx` to call it, show sending/sent/error states, and clear the form only on success.
- **A2. Rebuild the 404 page.** In `src/routes/__root.tsx`, replace `NotFoundComponent` with a `SiteLayout`-wrapped block using `bg-paper`/`text-ink`, a bold display heading, and TanStack `<Link>` buttons back to Home, Events, and Classifieds. Change the error-page "Go home" `<a>` to a `<Link>`.
- **A3. Fix Google OAuth landing.** In `src/routes/auth.tsx`, set `redirect_uri: ${window.location.origin}/auth` (or `/auth/callback`). In `AuthPage`'s existing `getSession` effect, when a session is detected route to `/members`. This keeps the fallback path consistent whether Google does a full-page redirect or a same-tab callback.
- **A4. Fix confirmation-email link.** Change signup `emailRedirectTo` to `${origin}/auth` so the confirmation click hits an unauthenticated route; the effect on `/auth` sees the session and pushes to `/members`.
- **A5. Clarify the contact block on `/classifieds/$id` for signed-in non-owners.** When `session` is truthy but `fullListing.contact` is null, render "Only the seller and admins can see contact details" (no Sign-in CTA). Keep the sign-in prompt only for anonymous visitors.

### Phase B — Reachability gaps

- **B1. Admin dashboard hub.** In `src/routes/_authenticated/members.tsx`, when the current user has the `admin` role, render an "Admin tools" card with links to `/admin/classifieds`, `/admin/shop`, `/admin/sponsors`, `/admin/newsletter`. Add a `getMyRoles` server fn (or extend `getMyProfile`) that returns `is_admin: boolean` from the `user_roles` table. Do not gate on client — the admin routes already enforce access in their own loaders/RLS.
- **B2. Gallery admin route.** Create `src/routes/_authenticated/admin.gallery.tsx` with upload (to `gallery` bucket), caption + `is_published` toggle, and delete. Add server fns in `src/lib/gallery.functions.ts` for `createGalleryItem`, `deleteGalleryItem`, `togglePublish`. Link from the admin hub in B1.
- **B3. Events admin route.** Create `src/routes/_authenticated/admin.events.tsx` with a CRUD form for `public.events` (title EN/AF, description EN/AF, `starts_at`, `location`, `cover_url`, `is_published`). Add matching server fns in `src/lib/events.functions.ts`. Link from the admin hub.

### Phase C — Flow polish

- **C1. Shop enquiry modal.** Add an explicit close (X) button; on success show a green confirmation state inside the modal and auto-close after ~2s; on error show the message inline with a retry button.
- **C2. Classifieds new-listing "Back" is context-aware.** Track referrer with `location.state` (`from`) when the user opens `/classifieds/new` from `/classifieds`; fall back to `/classifieds/mine` otherwise.
- **C3. Photo signed-URL lifetime.** Extend previews on `/classifieds/new` from 1h to 12h (still short-lived, avoids stale thumbnails during long form sessions).
- **C4. Mobile nav.** Collapse the 9-item bottom bar to 5 primary items (Home / Events / Classifieds / Members / More) with a "More" sheet exposing Gallery / Shop / Sponsors / About / Join / Contact. Keep the desktop nav unchanged.
- **C5. Auth mode-switch cleanup.** Clear `info` and `error` in every mode-toggle handler.

### Phase D — Nits

- **D1.** Replace the remaining `<a href="/">` inside `ErrorComponent` with `<Link to="/">`.
- **D2.** Verify `handleFiles` cleans up any storage objects that were uploaded but then removed from the `photos` state before submit (currently they leak into the private bucket). Add a `supabase.storage.from("listings").remove([path])` call in the remove-photo click handler.

## Verification

After each phase, in build mode:
- `bun run build` and `tsgo` for typecheck.
- Playwright script in `/tmp/browser/` that walks: `/` → header nav to each public route → footer Menu links → `/join` → `/auth` (sign in with the injected Supabase session per browser-use rules) → `/members` → `/members/card` → `/classifieds` → `/classifieds/$id` → `/classifieds/new` → submit test listing → verify redirect → `/contact` → submit → verify success state and admin inbox (via server logs). Screenshot each step; grep console for errors.
- Manually hit `/does-not-exist` and confirm the new 404 renders inside `SiteLayout` with working nav.

## Out of scope for this plan

- Copy rewrites, i18n dictionary expansion, and visual redesign of any page.
- Payments, forums, member directory, tech articles (not requested).
- Changes to Supabase schema for anything beyond adding `admin_gallery`/`admin_events` server fns and (optionally) a lightweight `getMyRoles` helper.
