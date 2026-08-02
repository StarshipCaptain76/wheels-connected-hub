## Goal

After an event is created/published, an admin can press **Invite all members** and every approved member receives a branded HTML email with the event details, a map image, and three one-click voting buttons (Going / Maybe / Can't make it) that record their RSVP without needing to log in.

## What the admin sees

On each event row in Admin → Events:
- A new **Invite all members** button (only for published events).
- A confirm dialog showing the recipient count ("Send invite to 42 members?").
- After sending: a small note "Invited 42 members · 2 Aug 14:30" stored on the event, plus a **Resend / send to new members only** option so nobody gets spammed twice.
- Bilingual: each member gets the email in their own language preference (EN/AF), defaulting to English.

## What the member receives

A single-column mobile-friendly email in club styling (red/ink/paper, cartoon logo header):
- Event title, date & time (SA format), location.
- Short description / details excerpt.
- A static Google map image of the destination (with pins for meet-up waypoints), clickable through to the event page.
- Waypoint/meet-time list if the event has them.
- Three big buttons: **I'm going · Maybe · Can't make it**.
- A "View full event & route" link to `justwheels.co.za/events/<id>`.

Clicking a vote button opens a Just Wheels confirmation page saying "Thanks, you're marked as Going" with links to the event page — no login required.

## Technical section

**Database (one migration)**
- `public.event_invites` — `event_id`, `user_id`, `email`, `token` (uuid, unique), `sent_at`, `responded_at`, `response`. Unique on (event_id, user_id) so resends skip already-invited members. RLS: admin-only read/write via `has_role`; GRANTs for `authenticated` + `service_role` (tokens are consumed server-side through the service role, not the Data API).
- `public.events`: add `invites_sent_at timestamptz`, `invites_sent_count int`.

**Server**
- `src/lib/event-invites.functions.ts` (createServerFn, `requireSupabaseAuth` + `has_role` admin check):
  - `getEventInviteStatus({ eventId })` — counts of eligible members / already invited.
  - `sendEventInvites({ eventId, onlyNew })` — loads approved, non-suspended members with emails via `supabaseAdmin` (inside the handler), creates invite tokens, renders the HTML per member language, sends through Resend in batches (Resend batch endpoint, ≤100 per call, sequential with small delay), then updates `invites_sent_at/count`. Returns `{ sent, skipped, failed }`.
- `src/lib/event-invite-email.server.ts` — HTML builder reusing `emailShell`/`escapeHtml` from `email.server.ts`; static map URL built from `destination_lat/lng` + waypoints using the existing Google Maps key (Static Maps API), with graceful fallback to a text-only email if no coordinates.
- `src/routes/api/public/event-rsvp.ts` — `GET ?token=…&r=going|maybe|not_going`: looks up the token, upserts into `event_rsvps` for that user, marks the invite responded, returns a styled HTML confirmation page (and handles unknown/expired token gracefully). Token in the URL is the only credential, so it does nothing except set that one RSVP.

**UI**
- `src/routes/_authenticated/admin/events.tsx`: invite button, confirm dialog with counts, sending state, success toast, and the "last invited" line. No changes to the public event page.

**Notes**
- Emails are per-recipient (personalised token), triggered by an admin action for a specific event — no marketing list involved; unsubscribed newsletter status is irrelevant since this is club-member notification.
- `From: Just Wheels <events@notify.justwheels.co.za>` on the existing verified subdomain.
