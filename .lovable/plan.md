## Scope

Content and access-control adjustments across Join, Contact, Gallery, Classifieds, Shop and Sponsors. WhatsApp deep link target: **Hugo van Dyk +27 83 686 9237** → `https://wa.me/27836869237`.

## 1. `/join` — rework (no yearly fee)

- Remove price card (`join.priceLabel`, `join.priceValue`, `join.priceNote`) from `src/routes/join.tsx` and drop those keys from `src/i18n/dictionaries.ts`.
- Replace with a "How to join" panel: benefits list (kept) + steps → 1) Create account, 2) Fill in profile, 3) Meet the crew at the next run.
- "Sign up now" button becomes a working `<Link to="/auth">` (currently a dead `<button>` — that's the "clicking does nothing" bug). Add a secondary "See next event" link to `/events`.
- Update `join.subtitle` copy to remove "sign up" fee wording; add `join.howTitle`, `join.step1/2/3` dictionary keys (EN + AF).

## 2. `/contact`

- Remove Facebook and Instagram tiles from `src/routes/contact.tsx`.
- Replace WhatsApp "group" tile with a single WhatsApp deep-link tile:
  - Label: "WhatsApp Hugo" / "WhatsApp Hugo" (AF)
  - `href="https://wa.me/27836869237"` with `target="_blank" rel="noopener"`.
- Update `contact.subtitle` copy to drop "socials" mention (EN + AF).

## 3. `/gallery`

- Currently no socials render on gallery; audit shows only the grid. Confirm nothing to remove there — the "socials icons" the user mentions are actually only on `/contact`. **Action**: none on gallery beyond what's in §2. (If the intent was the footer, clarify — footer currently has no socials either.)
- Add a small "Share a photo? WhatsApp Hugo" link under the header pointing to `https://wa.me/27836869237`.

## 4. `/classifieds` — auth-gate posting only

Public browsing is already open; posting/editing already lives under `_authenticated/` and RLS restricts edit/delete to owner or admin. Two UX fixes:

- In `src/routes/classifieds.tsx`, read auth state (via existing supabase client hook pattern used in `SiteLayout`) and:
  - Show **"Post a listing"** button only when signed in.
  - When signed out, show a subtle "Sign in to post a listing" link → `/auth`.
- No RLS changes required (already correct per current migrations).

## 5. `/shop` — admin-managed catalog

Today the catalogue is hard-coded in `src/routes/shop.tsx`. Move it to the database so admins can CRUD items + prices.

- **Migration** (new): create `public.merch_items` with columns: `name`, `name_af`, `description`, `description_af`, `price_zar` (numeric), `sizes` (text[]), `image_url` (nullable, from existing storage), `is_active` (bool), `sort` (int). Standard `id/created_at/updated_at`.
  - GRANTs: `SELECT` to `anon, authenticated`; `ALL` to `authenticated` (policy-gated) and `service_role`.
  - RLS: public `SELECT` where `is_active = true`; admin `ALL` via `has_role(auth.uid(),'admin')`.
  - Trigger: `set_updated_at`.
  - Seed the current 6 hardcoded items so the page is not empty on first load.
- **Server fns** (`src/lib/merch.functions.ts`): add `listActiveMerch`, `listAllMerch` (admin), `upsertMerchItem`, `deleteMerchItem` (both admin-gated in handler via `has_role` check).
- **`/shop`**: fetch from `listActiveMerch`; enquiry form flow untouched.
- **New admin route**: `src/routes/_authenticated/admin.shop.tsx` — table with add/edit/delete/toggle-active, gated by role check in loader/component (redirect non-admins).

## 6. `/sponsors` + carousel — admin-only management

Sponsor DB + RLS already admin-only; only missing piece is an admin UI (currently sponsors can only be added via SQL).

- **New admin route**: `src/routes/_authenticated/admin.sponsors.tsx` — list/create/edit/delete sponsors, upload logo to existing private `sponsors` bucket, toggle `is_active`, reorder via `sort`. Role-gated identical to admin.shop.
- Public `/sponsors` page and `<SponsorCarousel />` unchanged (already read-only for non-admins).
- Add nav links to `/admin/shop` and `/admin/sponsors` in the members/admin menu (visible only when `has_role admin`).

## 7. Nav / menu

- Extend the admin dropdown (already showing Classifieds moderation + Newsletter) with **Shop** and **Sponsors** entries, gated on admin role.

## Technical notes

- WA link format: `https://wa.me/27836869237` (no `+`, no spaces).
- Admin gating pattern reuses `has_role(auth.uid(),'admin')` in server-fn handlers and a client-side role check (already used elsewhere) to hide admin nav.
- All new admin server fns use `.middleware([requireSupabaseAuth])` and re-check `has_role` inside `.handler()` before mutating.
- No changes to auth flow, PWA config, or SEO.

## Out of scope / to confirm

- Whether to also delete `join.priceLabel/Value/Note` translations entirely (recommended: yes).
- Whether footer should get a WhatsApp/Hugo link too (not requested).