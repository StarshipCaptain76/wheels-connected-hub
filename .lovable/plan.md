
# Phase 5 — Polish & Growth

Five independent sub-phases, each shippable on its own. All follow the existing patterns: bilingual EN/AF via `useI18n`, TanStack routes with `head()`, Lovable Cloud (Supabase) tables with explicit GRANT + RLS, server functions in `*.functions.ts`, public reads through `createPublicSupabase()`, member writes through `requireSupabaseAuth`.

---

## Phase 5.1 — Classifieds & Merch Enquiry

### Classifieds (no payments; buyer contacts seller)

**DB migration**
- `public.listings` — `id, user_id (auth.users), title, title_af, description, description_af, price_zar (numeric), category (enum: parts, cars, memorabilia, other), condition (enum: new, used, project), location, contact_name, contact_phone, contact_email, status (enum: pending, approved, rejected, sold), created_at, updated_at`.
- `public.listing_photos` — `id, listing_id, image_url, sort, created_at`.
- Storage bucket `listings` (public read, authenticated write, path prefix `${user_id}/`).
- RLS:
  - Public SELECT where `status = 'approved'`.
  - Members: SELECT/INSERT/UPDATE their own; only admins can change `status`.
  - Admins: full manage via `has_role(auth.uid(), 'admin')`.
- GRANT SELECT to anon (approved rows), full CRUD to authenticated (scoped), ALL to service_role.
- `updated_at` trigger via existing `set_updated_at()`.

**Server functions** (`src/lib/listings.functions.ts`)
- `listApprovedListings({ category?, search? })` — public read via `createPublicSupabase()`.
- `getListing(id)` — public, only approved OR own OR admin.
- `listMyListings()` — `requireSupabaseAuth`.
- `createListing(input)` / `updateListing(input)` — Zod-validated, `requireSupabaseAuth`, status forced to `pending` on create.
- `deleteListing(id)` — owner or admin.
- `moderateListing(id, status)` — admin only (verified via `has_role` RPC through `context.supabase`).

**Routes**
- `/classifieds` — public grid with category filter chips and search.
- `/classifieds/$id` — public detail: photos, description, contact card (phone + reveal-on-click email to reduce scraping — `mailto:` built client-side from split parts).
- `/_authenticated/classifieds/new` — create form (title, prices in ZAR, category, condition, description, up to 6 photos uploaded to storage).
- `/_authenticated/classifieds/mine` — my listings with edit/delete + status badge.
- `/_authenticated/_admin/classifieds` — moderation queue (approve/reject). Admin subtree gated by a `beforeLoad` role check calling `has_role`.

**UI**
- Card style matching existing events cards (2px ink border, offset shadow, red status pills).
- "Contact seller for payment" notice on every listing.

### Merchandise enquiry (no shop)

- `/shop` public page: hero, "Coming soon / by request" copy, product cards (static seed list of items: club tee, cap, sticker pack, badge — data in `src/data/merch.ts`, bilingual).
- Each card opens an enquiry modal: name, email, item, size, quantity, message.
- Server function `sendMerchEnquiry(input)` — Zod validated, sends email via Lovable managed email (transactional template `merch-enquiry`) to `admin@justwheels.co.za`.
- Admin address obfuscated in UI (never rendered as plaintext or `mailto:`); it lives server-side only.
- Requires email domain scaffolding: call `email_domain--check_email_domain_status` first; if none, run setup dialog. Then `email_domain--scaffold_transactional_email_templates` and register a `merch-enquiry` template (subject "New merch enquiry — {item}", body includes all form fields).
- Rate-limit: reject if same IP+email submits > 3 in 10 min (in-memory best-effort inside the fn; acceptable for a low-volume club site).

---

## Phase 5.2 — Sponsors

**DB**
- `public.sponsors` — `id, name, logo_url, website_url, tier (enum: gold, silver, bronze, friend), sort, is_active, created_at, updated_at`.
- Storage: reuse `gallery` bucket under `sponsors/` prefix, or add a dedicated `sponsors` bucket (public read).
- RLS: public SELECT where `is_active = true`; admin manage.

**UI**
- `SponsorCarousel` component (Embla or a plain marquee with `prefers-reduced-motion` guard) — placed on Home footer strip and `/about` bottom.
- Sponsor logos link to `website_url` with `rel="noopener sponsored"`.
- `/sponsors` public route: full grid grouped by tier + "Become a sponsor" CTA.
- CTA opens sponsor enquiry modal → `sendSponsorEnquiry(input)` server fn → transactional email `sponsor-enquiry` to `admin@justwheels.co.za` (same masking approach as merch).
- Admin route `/_authenticated/_admin/sponsors` (CRUD).

---

## Phase 5.3 — Google Calendar Feed

Two-way requirement: expose club events as a subscribable calendar, and optionally mirror events from a linked Google Calendar.

**Public ICS feed (primary)**
- Server route `src/routes/api/public/events.ics.ts` — reads published upcoming + recent past events from `events` table, emits standards-compliant `text/calendar` with `VEVENT`s (uid = event id, dtstart/dtend, summary, description, location, url back to `/events/$id`).
- Cache headers `public, max-age=1800`.
- Link on `/events` page: "Subscribe (Apple/Google Calendar)" + "Add to Google" (`https://calendar.google.com/calendar/r?cid=<url-encoded feed>`).

**Optional: mirror from Google Calendar** (only if user wants it now)
- Use existing Google Calendar connector (workspace-level — club calendar owned by the committee).
- Nightly server route `/api/public/cron/sync-google-calendar` (triggered by external cron, protected by `CRON_SECRET`) reads events from the connected calendar via gateway and upserts into `events` table.
- Recommend deferring this until we know if the committee already maintains a Google Calendar; ICS export covers the "subscribe" need on its own.

Plan proceeds with ICS feed only unless the user confirms mirror is needed.

---

## Phase 5.4 — Newsletter (Resend)

Since the app already uses Lovable managed email for auth + app emails, newsletters go through **Resend** as requested (Lovable Emails does not do marketing/bulk).

- Connect Resend via `standard_connectors--connect` (connector_id `resend`).
- `public.newsletter_subscribers` — `id, email (unique), name, lang ('en'|'af'), status ('pending'|'confirmed'|'unsubscribed'), confirm_token, unsubscribe_token, created_at, confirmed_at`.
- RLS: no anon SELECT; INSERT open (rate-limited) via server fn only.
- Signup component in footer + `/newsletter` page: email + language.
- Server fn `subscribeNewsletter(input)` → insert pending row → send confirmation email via Resend gateway (double opt-in link → `/api/public/newsletter/confirm?token=`).
- Server route `/api/public/newsletter/confirm` marks confirmed.
- Server route `/api/public/newsletter/unsubscribe` marks unsubscribed (one-click, token-based; token also embedded in every send).
- Admin composer `/_authenticated/_admin/newsletter`: subject, markdown body per language, preview, send. Batches to confirmed subscribers via Resend, chunked with `bcc` groups of 50 (or Resend batch API), unsubscribe link in footer of every send.
- Suggest to user: keep newsletters low-volume; Resend free tier limits apply.

---

## Phase 5.5 — SEO

- Audit every route's `head()`; ensure unique `title`, `description`, `og:title`, `og:description`, `og:type`, `twitter:card`. Homepage adds `og:image` from the club logo (absolute URL via `getRequestOrigin` server fn).
- Add `/events/$id` detail route (currently only list exists) so events are individually shareable — required for JSON-LD:
  - `head()` includes `og:type=event`, cover image as `og:image`.
  - JSON-LD `Event` schema in `scripts` array with `name`, `startDate`, `endDate`, `location` (PostalAddress), `image`, `organizer` (Just Wheels Hessequa), `eventStatus`, `eventAttendanceMode`.
- Add `Organization` JSON-LD in `__root.tsx` (name, logo, sameAs socials).
- Add `BreadcrumbList` on deep routes (`/events/$id`, `/classifieds/$id`).
- `public/robots.txt` — allow all, disallow `/_authenticated/*` and `/api/*`, `Sitemap:` line pointing to `/sitemap.xml`.
- Dynamic sitemap at `src/routes/sitemap[.]xml.tsx`:
  - Static: `/`, `/about`, `/join`, `/contact`, `/events`, `/gallery`, `/classifieds`, `/shop`, `/sponsors`, `/newsletter`.
  - Dynamic: one entry per published event, one per approved listing.
  - No `<lastmod>` unless we can source it from `updated_at` (we can — include it for events/listings only).
- Trigger SEO scan after deployment.

---

## Technical Notes

- All new tables follow the CREATE → GRANT → RLS ENABLE → CREATE POLICY order in a single migration.
- Public reads use `createPublicSupabase()` (server publishable key); member/admin writes go through `requireSupabaseAuth` + `has_role` RPC.
- Storage uploads validated: max 5 MB/image, `image/*` only, resized client-side to ≤ 1920px before upload.
- Admin routes live under `/_authenticated/_admin/` with a `beforeLoad` role gate; child pages don't re-check.
- Every new user-facing string added to `src/i18n/dictionaries.ts` in both EN and AF.
- Email addresses in UI use split-and-join obfuscation + reveal-on-interaction; the real `admin@justwheels.co.za` lives only as a constant in server code.

---

## Suggested Delivery Order

Ship 5.5 (SEO) alongside 5.1 so new classifieds/shop pages are indexable from day one; 5.2 → 5.3 → 5.4 in that order. Confirm and I'll start with 5.1 + 5.5.

## Open Questions
- Should sub-phase 5.3 include the Google Calendar → events mirror, or ICS export only?
- Newsletter: confirm Resend is the right choice (vs deferring newsletter entirely)?
- Admin email `admin@justwheels.co.za` — is this address already active and monitored?
