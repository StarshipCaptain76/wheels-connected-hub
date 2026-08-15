# Concours Mini: live prominence, bolder CTA, funny winner blurb

## 1. Concours jumps to the top once the event is live

On the event page the Concours Mini block currently sits at the very bottom, under the map, waypoints, distances, info, RSVP and photos.

- While the event is running (started, and until it ends / midnight of the event day) the Concours block renders directly under the event hero — above everything else.
- Before the event and after it has ended it stays where it is today (bottom of the page), so the running order only changes when it matters.
- On the events list, the "Happening Today" hero card gets a short "Score the cars" link straight into the concours block, so members entering from the list land in the right place.

## 2. Bolder call to action for entering / starting scoring

The current "open" frame is a quiet bordered box. It becomes a proper call to action:

- Full-width high-contrast panel with the trophy mark, a live "Scoring is open now" pill, and the prize and sponsor line.
- One large primary button — "Start scoring" (Afrikaans: "Begin punte gee") — with the check-in / location step folded into that same button flow rather than shown as a separate technical step.
- A clear progress line under it: "3 of 12 cars scored", with the button label switching to "Continue scoring" once at least one car is done, and "You've scored every car" when finished.
- Non-members / spectators see the same bold panel with a one-line note that they can vote as a spectator.

## 3. AI winner blurb on the home page

When an admin reveals the results and puts them on the home page, a light-hearted blurb is generated automatically and shown in the home-page winner card.

- The blurb is written from what voters actually scored: the winning car's questions, its strongest and weakest answers, average score and number of votes.
- Tone: funny and playful, gently teasing the car, never the owner — respectful of the person and the machine. Roughly 40-60 words.
- Generated in both English and Afrikaans, saved with the result, and editable by the admin before or after publishing, with a "Regenerate" button.
- The home-page winner card gains the blurb under the score line, in the visitor's chosen language.

## Technical notes

- `src/routes/events.$id.tsx`: derive an `isLive` flag from `starts_at` / `ends_at` and render `<ConcoursChallenge>` in one of two slots (top when live, bottom otherwise); the component still owns its own phase logic.
- `src/components/ConcoursChallenge.tsx`: redesign the "open" state header into the bold CTA described above, including scored-count progress; no change to scoring/voting rules.
- `src/routes/events.index.tsx`: add the deep link on the today hero card.
- Database migration on `event_concours`: add `winner_blurb_en` and `winner_blurb_af` text columns (nullable). No new table, so no new grants or policies needed.
- `src/lib/concours.functions.ts`: new admin server function `generateConcoursWinnerBlurb` calling the Lovable AI gateway (same pattern as the newsletter and translation helpers) with the winning car's aggregated answers; `publishConcoursResults` accepts and stores the two blurb fields, and `getLatestConcoursHomeWinner` returns them.
- `src/components/ConcoursAdminPanel.tsx`: blurb textareas (EN/AF) with Generate / Regenerate in the publish step.
- `src/components/ConcoursHomeWinner.tsx`: render the blurb.
