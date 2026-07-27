
# Just Wheels Hessequa — PWA Implementation Plan

A bilingual (EN/AF), installable Progressive Web App for the Just Wheels Hessequa car club, built on the existing TanStack Start + Lovable Cloud stack. Design draws from AMOC (calm authority), VSCC (rich event listings & archives) and MMOC (practical members features), reinterpreted through the club's bold red/black character-forward logo.

---

## Design Direction

**Vibe:** Bold & playful, garage-workshop energy — matches the shaggy caveman/wheel mascot.

- **Palette (tokens in `src/styles.css`):**
  - Primary Red `oklch(0.58 0.22 27)` (from logo circle)
  - Ink Black `oklch(0.18 0 0)`
  - Steel Grey `oklch(0.72 0.01 260)` (wheel/nut tones)
  - Off-white paper `oklch(0.98 0.005 90)`
  - Accent Rust `oklch(0.55 0.15 45)`
- **Type:** Display — `Bebas Neue` (chunky headlines, race-poster feel); Body — `Barlow` (sans, workhorse).
- **Motion & texture:** Slight rotation on hover for cards, subtle grain overlay, sticker-style badges, hand-drawn dividers. Restrained — not cartoony.
- **Logo usage:** Circular sticker treatment in hero and PWA icon; never stretched.
- **Component language:** Chunky rounded rectangles (radius-lg), thick 2px borders on cards, red/black CTAs with slight offset shadow (neo-brutalist nod).

---

## Sitemap

Public:
- `/` Home — hero, next event, latest gallery, join CTA (EN/AF toggle)
- `/events` — upcoming + past runs, breakfasts, shows
- `/events/$slug` — single event with map, entry button, gallery
- `/gallery` — photo albums by event/year
- `/about` — club history, committee, area (Hessequa/Riversdale)
- `/join` — membership benefits, pricing (ZAR), signup CTA
- `/contact` — form + WhatsApp/social links
- `/auth` — sign in / sign up

Members (`_authenticated/`):
- `/members` — dashboard: digital member card, next event, notices
- `/members/card` — offline-cacheable digital member card
- `/members/directory` — opt-in member list
- `/members/events/$slug/rsvp` — RSVP flow

---

## Phased Delivery

### Phase 1 — Foundation & Public Site (MVP)
1. Replace placeholder `src/routes/index.tsx` with real Home.
2. Design system: install fonts, write tokens in `src/styles.css`, update root head metadata (title/description/OG per route).
3. Logo asset via `lovable-assets` from the upload; generate PWA icon set (192, 512, maskable).
4. Bilingual toggle (EN/AF) using a lightweight i18n context + JSON dictionaries (`src/i18n/en.json`, `af.json`); language stored in `localStorage`.
5. Routes: `/`, `/about`, `/join`, `/contact` (contact form validated with Zod, sends via a server function).
6. Global layout: sticky nav with logo, language toggle, join CTA; footer with socials + sponsor slot.

### Phase 2 — Events & Gallery
1. Enable **Lovable Cloud**; create tables:
   - `events(id, slug, title_en, title_af, description_en, description_af, starts_at, ends_at, location, lat, lng, cover_url, published)`
   - `event_rsvps(id, event_id, user_id, status)`
   - `gallery_albums(id, slug, event_id, title, cover_url, created_at)`
   - `gallery_photos(id, album_id, url, caption, sort)`
   - Public SELECT policies on published events/albums/photos (TO anon); grants per template.
2. Public routes: `/events`, `/events/$slug` (with embedded map via existing Google Maps connection if user links it later; else static coords), `/gallery`, `/gallery/$slug`.
3. Rotating "Featured Member/Ride" widget on Home reading from a `featured` table.
4. Social media links (Facebook / Instagram / WhatsApp group) in footer + share buttons on events.

### Phase 3 — Membership & Members Area
1. Auth: email/password + Google (via `supabase--configure_social_auth` + `lovable.auth.signInWithOAuth`).
2. `profiles` table (auto-populated via trigger): `first_name, last_name, vehicle, town, member_since, membership_status, phone, opt_in_directory`.
3. Separate `user_roles` table + `has_role()` security definer (admin/committee/member) per template rules.
4. Integration-managed `_authenticated/` layout; build:
   - `/members` dashboard
   - `/members/directory` (only opt-in profiles)
   - `/members/card` — digital member card (name, member #, photo, expiry, QR)
5. RSVP flow on event pages for signed-in members.
6. Admin surface (`/_authenticated/_admin`): create/edit events, upload gallery photos (Lovable Cloud storage), approve members.

### Phase 4 — PWA: Installable + Offline Member Card
Follows the PWA skill's offline path.
1. Add `vite-plugin-pwa` with `generateSW`, `registerType: "autoUpdate"`, `injectRegister: null`.
2. Manifest: name "Just Wheels Hessequa", short name "Just Wheels", theme `#c22`, background `#0e0e0e`, `display: standalone`, icons from the logo.
3. Guarded registration wrapper (refuses in dev, Lovable preview iframes, `?sw=off`).
4. Workbox runtime caching:
   - `NetworkFirst` for HTML navigations
   - `CacheFirst` for hashed built assets
   - `StaleWhileRevalidate` for `/api/public/events` + gallery images
   - Precache the `/members/card` shell + last-fetched card data (persisted to IndexedDB on sign-in) so the card renders offline.
5. Add "Install app" prompt component; iOS add-to-home-screen hint.

### Phase 5 — Polish & Growth (optional / future)
- Classifieds (parts/cars for sale) — separate `listings` table with photo upload and moderation.
- Merchandise shop — Stripe (ZAR) via `payments--enable_stripe_payments`.
- Newsletter via Resend connector.
- Google Calendar feed for public events (via existing Google connections).
- Sponsor carousel component with logos + links.
- SEO: per-route `head()` with unique title/description/OG, JSON-LD `Event` schema for event pages, sitemap route.

---

## Technical Notes

- **Stack (fixed):** TanStack Start v1, React 19, Tailwind v4, Lovable Cloud (Supabase-backed), shadcn/ui.
- **Data reads:** public pages use a server publishable Supabase client inside server fns; member reads use `requireSupabaseAuth`.
- **i18n:** custom lightweight context (no external lib) — two JSON dictionaries; `t("key")` helper; toggle in nav.
- **PWA safety:** service worker only registers in production, never in Lovable preview/iframe/dev.
- **Migrations:** every `CREATE TABLE public.*` includes explicit `GRANT` statements + RLS + policies in the same migration.
- **Assets:** logo uploaded via `lovable-assets` CLI; images generated per section prompts.
- **SEO/head:** each route overrides title, description, `og:title`, `og:description`; event pages set `og:image` to the event cover.

---

## Open Questions (can be answered during build)
- Membership pricing tiers (single, family, associate)?
- Committee list & contact details for `/about`?
- Any existing member database to import, or start fresh?
- Google Maps + Resend — link now for maps embed and contact-form emails, or defer to Phase 5?
