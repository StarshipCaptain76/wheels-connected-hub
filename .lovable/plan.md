
# Admin Portal — consolidated gated actions

Today the admin tools are scattered as sibling routes under `/admin/*` reached from a card on `/members`. This plan gives them a proper home: one gated `/admin` layout with a persistent sidebar, an overview dashboard, and two new sections (Members Management, Featured Member). Sponsors, Classifieds moderation, Shop, Newsletter, Events, and Gallery are folded into the same shell.

## Structure

```text
src/routes/_authenticated/admin/
  route.tsx          ← layout: verify admin server-side, render <AdminShell><Outlet/></AdminShell>
  index.tsx          ← overview: counts + quick actions
  members.tsx        ← NEW: list all members, edit status/role, set featured
  featured.tsx       ← NEW: pick current featured member + rotation
  classifieds.tsx    ← moved from admin.classifieds.tsx
  events.tsx         ← moved from admin.events.tsx
  gallery.tsx        ← moved from admin.gallery.tsx
  sponsors.tsx       ← moved from admin.sponsors.tsx
  shop.tsx           ← moved from admin.shop.tsx
  newsletter.tsx     ← moved from admin.newsletter.tsx
```

The `_authenticated` gate already blocks anonymous users. The new `admin/route.tsx` adds an admin check via a new `requireAdmin` server fn (calls `has_role` under `requireSupabaseAuth`) in `beforeLoad`, redirecting non-admins to `/members`. Every admin server fn keeps its own `has_role` check — the layout gate is UX, not the security boundary.

The existing `/members` "Admin tools" card becomes a single "Open admin portal" button linking to `/admin`.

## AdminShell (new component)

`src/components/AdminShell.tsx` — wraps children in `SiteLayout` and adds a left sidebar (collapses to a top tab bar on mobile) with grouped links:

- Overview
- Content: Events · Gallery · Featured Member
- Community: Members · Classifieds
- Commerce: Shop · Sponsors
- Comms: Newsletter

Active link uses `activeProps`. Each section renders inside a max-w-6xl content column.

## Overview dashboard (`/admin`)

Small server fn `getAdminOverview` returns counts:
- pending classifieds
- unpublished events (future)
- unpublished gallery items
- newsletter subscribers (active)
- members (total, pending status)
- current featured member (name)

Cards link to their section. Zero DB writes; read-only summary.

## NEW: Members Management (`/admin/members`)

Server fns (in `src/lib/admin-members.functions.ts`, all `requireSupabaseAuth` + inline admin check):
- `listAllMembers()` — join `profiles` + `auth.users` email via `supabaseAdmin` (loaded inside handler) to include email; return member_number, display_name, email, phone, town, membership_status, is_admin, joined_at.
- `updateMemberStatus({ userId, status })` — writes `profiles.membership_status` (`pending`/`active`/`suspended`).
- `setAdminRole({ userId, isAdmin })` — inserts/deletes `user_roles` row for `admin`. Guarded so an admin cannot remove their own admin role (avoid lockout).
- `setFeaturedMember({ userId | null })` — sets `is_featured` on profiles (new column, see migration).

UI: searchable table with inline status dropdown, admin toggle, "Set as featured" button, and a link to the member's classifieds count. Confirmation dialogs on destructive changes.

## NEW: Featured Member (`/admin/featured`)

Currently no rotating "Featured Member" widget exists on the site. This plan adds both the data + admin surface; the public widget is stubbed as a home-page card (opt-in — see "Out of scope" if not wanted).

- Migration adds `profiles.is_featured boolean not null default false` and `profiles.featured_bio text`, `profiles.featured_photo_url text`, `profiles.featured_since timestamptz`.
- Partial unique index ensures at most one featured member at a time.
- `/admin/featured` shows the current featured member's card preview + fields (bio EN, featured photo URL) and a "Choose different member" picker that reuses `listAllMembers`.
- `getCurrentFeaturedMember` public server fn drives a small `<FeaturedMemberCard>` on `/` (home) and `/members` sidebar.

## Migration (single call)

```sql
alter table public.profiles
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_bio text,
  add column if not exists featured_photo_url text,
  add column if not exists featured_since timestamptz;

create unique index if not exists profiles_only_one_featured
  on public.profiles ((true)) where is_featured;

-- Allow public read of ONLY the featured member's safe fields.
create policy profiles_public_read_featured
  on public.profiles for select to anon, authenticated
  using (is_featured = true);
```

Existing `profiles_read_own` and admin policies remain. The new `TO anon` policy is narrowed to `is_featured = true` rows only; the public server fn projects only `display_name`, `member_number`, `town`, `favourite_ride`, `featured_bio`, `featured_photo_url`, `featured_since`.

## Moved files

Rename admin routes into the folder (URLs stay the same: `/admin/events`, etc.). Update imports where nothing else depends on the old file paths. `src/routes/_authenticated/members.tsx` swaps its 6-link grid for one "Open Admin Portal" CTA (admin-only).

## Verification

- `bun run build` + `tsgo`.
- Playwright: sign in as admin → visit `/admin` → each sidebar link renders inside the shell → change one member's status, toggle admin role on a second test account, set featured member, confirm home page shows the featured card. Repeat as non-admin: `/admin` redirects to `/members`.

## Out of scope (ask if wanted)

- Public "Featured Member" home-page widget styling — a minimal card is included; a full rotating carousel can be a follow-up.
- Bulk actions on classifieds or subscribers.
- Audit log of admin actions.
- Impersonation / view-as-member.
