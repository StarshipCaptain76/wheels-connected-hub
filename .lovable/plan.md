## Goal

A bell icon in the header showing in-app notifications, with per-user on/off switches for each notification type.

## Notification types

Members (all active members):
- New classified listing published
- New event published
- New newsletter sent

Admins only:
- New sponsor application received
- New member signed up (awaiting approval)
- New listing awaiting moderation

## Database

New table `public.notifications`
- recipient (user), type, title/body (English + Afrikaans), link path, related record id, read flag, created timestamp
- Members read/update only their own rows (marking read); inserts happen server-side only
- Realtime enabled so the bell updates live

New table `public.notification_prefs`
- one row per user, one boolean per notification type (default all on)
- Users read and edit only their own row

Both tables get grants + RLS following project conventions.

A shared server helper `fanOut(type, payload)` inserts one notification per eligible recipient (all approved members, or admins for the admin-only types), skipping anyone who has that type switched off.

## Wiring into existing flows

- `listings.functions.ts` — on submit → admin "needs moderation"; on approve/publish → member "new classified"
- `events.functions.ts` — on publish → member "new event"
- `newsletter.functions.ts` — on send → member "new newsletter"
- `sponsor-applications.functions.ts` — on submit → admin
- `member-signup.functions.ts` — on signup → admin

Existing emails stay as-is; in-app notifications are additive.

## UI

- `NotificationBell.tsx` in the header (signed-in only): unread count badge, dropdown list of the latest 20, each row links to the relevant page and marks itself read, plus "Mark all read".
- Notifications page at `/members/notifications` for the full history.
- Settings section in the member profile sidebar: a toggle per notification type, saved immediately, bilingual labels. Admin-only toggles show only for admins.
- All strings added to the EN/AF translation files; styling uses existing design tokens.

## Technical notes

- Fan-out runs inside existing server functions using the admin client after the caller is authorised; failures are logged and never block the primary action.
- Realtime subscription set up in a `useEffect` with channel teardown; query cache invalidated on new rows.
- Preference check happens at insert time, so switching a type off stops future notifications (existing ones stay).
