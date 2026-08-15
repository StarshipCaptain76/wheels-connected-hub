# Next Up event: correct ordering, today's fuss, day-before reminder

## What changes for members

1. **The banner always shows the true next event.** Right now an event that started earlier today (or has no end time yet) drops off the home page banner. It will instead stay as "Next up" for the whole day it happens, and only roll over to the following event at midnight.
2. **Big fuss when it's today.** If the next event is today, the banner switches to a "TODAY" treatment: a pulsing "Happening today" badge, the start time in large type, a countdown-style line ("Starts in 3 hours" / "Under way now"), and a stronger call-to-action button ("Get directions" when the event has a location, otherwise "See details"). Tomorrow's event gets a lighter "Tomorrow" tag.
3. **Day-before reminder.** Every afternoon the app checks for events starting the next day and sends each active member:
   - an in-app bell notification ("Tomorrow: <event title>" with time and place, linking to the event page), and
   - a reminder email in their language, from the chief mechanic and his crew, with the event details and a link.
   Members who have turned off event notifications in their preferences are skipped, and each event only ever sends once.

## Technical notes

**Home page banner**
- `getNextEvent` in `src/lib/events.functions.ts`: replace `.gte("starts_at", now)` with a start-of-today (Africa/Johannesburg) cutoff so an event stays current all day, and return `starts_at`/`location` for the display logic.
- `src/routes/index.tsx`: derive `isToday` / `isTomorrow` from the local date and render the emphasised "today" variant of the existing banner. Compute the date state after hydration (`useEffect`/`useHydrated`) so SSR and client markup match — the home page already logs a hydration mismatch in this area, so the date-dependent bits must not render differently on the server.
- New i18n keys in `src/i18n/dictionaries.ts` for the today/tomorrow labels, countdown text and CTA (EN + AF).

**Reminder job**
- Migration: add a `reminder_sent_at timestamptz` column to `events`, add `event_reminder` to the allowed notification types in `fanout_notification` / `notify_user` and to `notification_prefs`, and add a `SECURITY DEFINER` function `events_needing_reminder()` returning published events starting in the next day that have not been reminded, plus `mark_event_reminded(_event_id)`. Both restricted to service/cron use, not `anon`.
- New public cron route `src/routes/api/public/hooks/event-reminders.ts`: validates the `apikey` header against the anon key, calls the two functions through a Supabase client built with that key, fans out in-app notifications, and sends the reminder email per member via the existing Resend mailer used for event invites.
- New email template for the reminder, styled like the existing event-invite mail, EN and AF copy.
- Schedule with `pg_cron` + `pg_net`, daily at 16:00 SAST (14:00 UTC), posting to the stable project URL.

**Not touched:** event creation/editing, RSVP logic, and the existing invite email flow.
