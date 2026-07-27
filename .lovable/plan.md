## Events v2 — Maps, Waypoints, RSVPs, Richer Content

Everything below is additive to the existing `events` table and admin flow. Existing events keep working; new fields are optional.

### 1. Data model (one migration)

Extend `public.events`:
- `destination_lat numeric`, `destination_lng numeric` — resolved once via Google Geocoding when admin picks a place.
- `destination_place_id text`, `destination_address text` — full formatted address for display.
- `hero_image_url text` — optional destination photo (separate from existing `cover_url` used for cards).
- `details_md text` / `details_af_md text` — long-form "more about this destination" (markdown, rendered safely).

New table `public.event_waypoints` (admin-defined meetup stops along the route):
- `event_id`, `label`, `label_af`, `address`, `lat`, `lng`, `place_id`, `meet_time timestamptz`, `sort int`.
- Public read when parent event is published; admin manage.

New table `public.event_rsvps`:
- `event_id`, `user_id` (unique together), `status` enum `going | maybe | not_going`, `party_size int` (only meaningful when going, 1–10), `note text`, timestamps.
- RLS: members read all RSVPs for published events (attendee list is members-only); members can insert/update/delete their own; admins can manage all.

Origin towns for distance display are hardcoded (Albertinia, Riversdale, Stilbaai, Heidelberg) with fixed lat/lng in a shared constants file — no need to store them.

### 2. Server functions

`src/lib/events.functions.ts` gains:
- `getEventDetail({ id })` — public: event + waypoints + counts (going/maybe/not_going). Uses publishable client.
- `listEventAttendees({ id })` — auth-required: returns going/maybe members with display name, member number, town, avatar.
- `upsertMyRsvp({ eventId, status, partySize, note })` — auth-required, validated with Zod.
- `deleteMyRsvp({ eventId })`.
- Admin: `saveEventWaypoints({ eventId, waypoints[] })`, extend existing `upsertEvent` to accept the new fields.

`src/lib/maps.functions.ts` (new, server-only):
- `geocodeAddress({ query })` — Google Geocoding via the connector gateway (server key).
- `computeRoute({ origin, waypoints[], destination })` — Routes API `computeRoutes`, returns overview polyline + total distance/duration.
- `distancesFromOrigins({ destination })` — Routes API `computeRouteMatrix` for the four fixed towns → destination, returns km + duration each.
- Results are cached in a lightweight `public.route_cache` keyed by a hash so we don't burn quota on every page view.

### 3. Browser map component

`src/components/EventMap.tsx`:
- Loads Maps JS via `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` with `loading=async` + `callback`.
- Renders destination pin, waypoint pins (numbered by sort), and the overview polyline from the server-side route response.
- Uses plain `google.maps.Marker` (no `mapId`, no AdvancedMarker).
- Skeleton fallback when key is missing; never crashes the page.

### 4. Admin portal — `/admin/events`

`src/routes/_authenticated/admin/events.tsx` (already migrated into the admin shell) grows an "Edit event" drawer:
- **Basics**: title/description EN + AF, dates, cover, published toggle (existing).
- **Destination**: place autocomplete input (Places API New browser autocomplete, then server geocode to persist lat/lng/place_id/address). Optional destination hero image upload → `gallery` bucket subfolder `events/<id>/`.
- **More info**: rich markdown editor for `details_md` (EN + AF tabs). Rendered client-side with `react-markdown` + `rehype-sanitize`.
- **Waypoints**: repeatable rows — label EN/AF, address (autocomplete), optional meet time, drag-sort. Save button calls `saveEventWaypoints`.
- **Live preview**: right-hand panel embeds `EventMap` + the origin distance table so the admin sees exactly what members will see.
- **RSVPs tab**: current going/maybe/no counts, table of attendees (name → members-only garage link), CSV export.

### 5. Public event page

New route `src/routes/events.$id.tsx` (list page keeps `/events`):
- Header: cover, title, when, where, published badge.
- **Map card**: `EventMap` with route polyline + waypoints.
- **Distances card**: table of Albertinia / Riversdale / Stilbaai / Heidelberg → destination (km + drive time), pulled from `distancesFromOrigins`.
- **Meetup stops card**: ordered list of waypoints with label, address, meet time (localised).
- **About this destination**: sanitized markdown render of `details_md` in current language.
- **RSVP card**:
  - Signed-out: "Sign in to RSVP" CTA.
  - Signed-in: three buttons (Going / Maybe / Not going). Choosing Going reveals a "How many in your group?" input (1–10). Optimistic update, saved via `upsertMyRsvp`.
- **Who's going** (signed-in only): grid of attendee cards → link to `/members/$member_number`. Public users see just totals ("24 going, 6 maybe").

### 6. Members-only "garage" page

New route `src/routes/_authenticated/members.$number.tsx`:
- Shows display name, town, favourite ride, avatar, member since, current RSVPs to upcoming events they're going to.
- Gated by `_authenticated` layout (already redirects to `/auth`).
- Attendee list links point here.

Backend: add `getMemberByNumber({ number })` server fn (auth-required) that returns only public-safe profile columns.

### 7. i18n & polish

- New keys in `src/i18n/dictionaries.ts` for RSVP, map, waypoints, distances, "more info" sections in EN + AF.
- Distance strings formatted with `Intl.NumberFormat` (km) and duration humanised ("1 h 42 min").
- All markdown rendering goes through `rehype-sanitize` — never `dangerouslySetInnerHTML` with raw input.

### 8. Ordering of work

1. Connect `google_maps` connector, add migration (events columns, waypoints, rsvps, route_cache) + RLS + GRANTs.
2. Server: `maps.functions.ts`, extend `events.functions.ts`, `getMemberByNumber`.
3. `EventMap` component + admin edit drawer with waypoints & destination picker.
4. Public `/events/$id` page with map, distances, RSVP, attendee list.
5. Members `/members/$number` garage page + attendee link wiring.
6. Admin RSVP tab + CSV export.
7. i18n sweep, empty states, error boundaries.

### Notes on scope kept out on purpose

- Members can't propose their own pickup points (per your answer). Waypoints are admin-only.
- Google Calendar events (read-only feed) stay list-only — no map/RSVP layer, since we don't own that data.
- No email/push notifications for RSVP changes yet; can be added later off the same tables.
