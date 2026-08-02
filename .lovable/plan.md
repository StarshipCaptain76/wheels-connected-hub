## Goal

Logged-in members can tag other members in gallery photos. If the person isn't a member yet, they can send them an invite email (sent on behalf of the tagging member). Tagged photos appear on the tagged member's profile as part of their photo carousel.

## 1. Database

New table `gallery_tags`
- `gallery_item_id` (photo), `tagged_user_id` (member), `tagged_by` (who tagged), `created_at`
- Unique on (photo, tagged member) so nobody is tagged twice in one picture
- Access rules: anyone can see tags on published photos; any approved member can add a tag; a tag can be removed by the person who created it, the person tagged, or an admin

New table `gallery_tag_invites`
- Photo, invited email, who invited, message, sent time, status (sent / joined)
- Only the inviter and admins can see their invite rows

Both get standard grants + row-level security.

## 2. Tagging in the gallery

On `/gallery`, when a signed-in member opens a photo:
- A **Tag members** control shows existing tags as removable chips (with member avatars, linking to that member's profile).
- **Add tag** opens a searchable member picker (name / member number / town), built from the existing directory list, excluding already-tagged people.
- Bottom of the picker: *"Can't find them? Invite by email"* — email field + optional short note, which sends the invite and records it.
- Bilingual EN/AF labels, consistent with the rest of the app.
- Members who aren't signed in see the tag names only (no editing).

## 3. Invite email (on behalf of the member)

New elegant HTML email in the club's style (red/ink/paper palette, logo, single call-to-action):
- Subject: e.g. *"Dawie tagged you in a Just Wheels photo"*
- Body: the photo thumbnail, who tagged them, their optional note, and a **Join Just Wheels Hessequa** button to `/join`
- Sent through Resend from the club's notify subdomain with **reply-to set to the tagging member's email**, so replies go to that member
- Recorded in `gallery_tag_invites`; the same email can't be spammed repeatedly for the same photo
- Rate-limited per member per day to prevent abuse

## 4. Tagged photos on member profiles

- New server function returns published gallery photos a member is tagged in.
- On `/members/:number` (public member profile) a **Tagged photos** section renders in the existing lightbox/carousel style, above or beside the Garage vehicles.
- On the member's own profile page, the same section appears with the option to untag themselves.
- In-app notification when someone tags you (reuses the existing notification system and settings, with a new "Tagged in a photo" toggle).

## Technical notes

- New `src/lib/gallery-tags.functions.ts` (server functions: list tags for photo, list tags for member, add tag, remove tag, invite by email) and `src/lib/gallery-tag-email.server.ts` for the HTML email, following the existing `email.server.ts` helpers.
- Tag UI lives in a new `src/components/PhotoTagger.tsx`, used from `src/routes/gallery.tsx`.
- Profile carousel reuses the existing `LightboxItem` pattern already used for garage vehicle photos.
- Notification fan-out added in `src/lib/notify.server.ts` with a new preference column.
