## What I verified

- The uploads **did** save. Both recent events have `cover_url` (and one has `hero_image_url`) stored in the database, pointing at `gallery/events/covers/...` and `gallery/events/heroes/...`.
- The images don't display because the `gallery` bucket is private and the server-side signing step is skipped: the backend environment currently has `SUPABASE_URL` and the publishable key but **no `SUPABASE_SERVICE_ROLE_KEY`**, which `signCovers()` requires. Fetching the stored URL directly returns HTTP 400.
- Result: on public pages the code deliberately drops unsigned private URLs to `null` (the red chevron placeholder), and in the admin list it keeps the URL, which then 404s (broken thumbnail).
- The `gallery` bucket's only public read rule covers published gallery items and active shop items — event covers/heroes are not included, so anonymous visitors can never read them even when a URL is correct.
- On the event page, the "Who's coming / Wie kom" block renders unconditionally (`src/routes/events.$id.tsx`, around line 300).

## Corrective plan

**1. Stop depending on the service key for event images (root fix)**

Add a storage read rule so objects referenced by a **published** event's `cover_url` or `hero_image_url` are readable by everyone — the same pattern already used for published gallery items and active shop items. Event covers are promotional images shown on the public events page, so this matches their intent.

With that in place the stored `/object/public/gallery/...` URLs work directly, in the browser, in the admin list, and in emails — no signing, no expiry, no service key.

**2. Keep signing as a fallback, but stop blanking images**

In `src/lib/events.functions.ts`, keep `signCovers()` for when the service key is present, but no longer null out event cover URLs when signing is unavailable — the public policy from step 1 makes the plain URL valid. This removes the red-chevron placeholders on `/events` and restores admin thumbnails.

**3. Hero image on the event detail page**

Confirm the detail route passes `hero_image_url` through the same resolution path as the cover, falling back to the cover when no hero is set.

**4. Hide "Who's coming" for past events**

In `src/routes/events.$id.tsx`, only render the attendee/RSVP frame while the event is still upcoming (end time if set, otherwise start time, compared to now). Past events keep their details, map, and photo gallery; the RSVP buttons and attendee list disappear.

**5. Verify**

- Reload `/admin/events` and confirm thumbnails render for both existing events.
- Reload `/events` and the detail page and confirm cover/hero images render, logged out as well.
- Re-upload one image end-to-end to confirm the save/display round trip.
- Open a past event and confirm the "Who's coming" frame is gone; open an upcoming one and confirm it still works.

## Technical notes

- New policy on `storage.objects` for `bucket_id = 'gallery'`, matching object names against `events.cover_url` / `events.hero_image_url` where `is_published = true`, mirroring the existing `gallery_public_read_published` policy shape.
- No change to `garage`, `listings`, or `sponsors` buckets; unpublished events' images remain unreadable to the public.
