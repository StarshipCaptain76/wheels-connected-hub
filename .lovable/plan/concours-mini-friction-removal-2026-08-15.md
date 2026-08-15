# Concours Mini — friction removal

Goal: admins load cars in seconds, members and spectators score in as few taps as possible, images actually show, and nobody is ever dropped back into a car they already scored.

## 1. Broken images

Concours photos are uploaded into the private `gallery` bucket but stored as a plain public URL, so the browser gets a 404 and shows a placeholder. Add a stable image endpoint (the same trick already used for event covers) and point every concours photo at it — event page grid, scoring screen, admin list and the home-page winner.

## 2. Admin: bulk photo add, no tagging

- One button: "Add cars" opens the phone camera / photo picker with multi-select.
- Every selected photo uploads in parallel with a small progress row, and each becomes a car entry immediately. No labels, no member search, no per-car form.
- Remove the member-tagging UI from the admin add flow entirely. Tagging stays available to members ("This is mine" / link to my garage) on the event page after the fact.
- Drop the "admin must GPS check in before adding cars" gate — admins upload from the field or from the office.

## 3. Scoring: who can score and how

- **Members**: no separate check-in button. The first time a member taps a car, GPS is read silently in the background and the check-in is recorded; if it succeeds they go straight into scoring. If GPS is refused or they are far away, they get one short line explaining it and can still score as a spectator.
- **Spectators (not signed in)**: GPS is asked once per event, remembered for the visit, and never asked again while scoring more cars. No sign-in, no account.
- Both audiences see the same car grid; the only difference is vote weight (member 1.0, spectator 0.5) and question count.

## 4. Questions: admin set + fresh random set per car

Each car is scored with the admin's chosen questions first, then an equal number of random questions drawn from the bank — re-drawn for each car, so no two cars feel identical. Spectators answer the admin set only (half the load), members answer both halves.

The random draw is decided by the server when a car's question set is requested, and the same draw is re-checked at submit so the answers always match a valid set.

## 5. Already-scored cars and returning to the page

- The event page loads the list of cars this visitor has already scored (by member id, or by device key for spectators) and marks them with a green tick + "Scored" and no longer opens the questionnaire on tap.
- On submit, the scoring screen closes automatically, the page scrolls back to the car grid, the just-scored car turns green, and a short "Thanks — scored!" line appears. No manual "back" tap.
- Nothing about the open questionnaire is remembered across reloads, so reopening the event page always lands on the car grid, never mid-poll.

## 6. General friction and speed

- Question navigation: picking an answer advances to the next question automatically; the last answer shows Submit. Prev stays available.
- The "check in on site" panel, the duplicate GPS error banners and the admin instruction paragraph all disappear — the section becomes: heading, prize line, car grid, leaderboard.
- Data loads in one round trip per concern and the vehicle list is cached; the questions for a car are fetched once when the car is opened.

## Technical notes

- New `src/routes/api/public/concours-image.ts` streaming vehicle photos by vehicle id, cached; `photo_url` values keep their current storage form.
- New server fns in `src/lib/concours.functions.ts`:
  - `addConcoursVehiclesBulk` — accepts an array of photo URLs, inserts all rows in one statement, drops the check-in requirement (admin role still required).
  - `getVehicleQuestionSet` — returns admin-selected ids plus a per-car random draw (seeded by event + vehicle + voter so it is stable on retry).
  - `listMyConcoursScores` — vehicle ids already scored by the caller (auth user) or by `voterKey` fingerprint for spectators.
- `submitConcoursScore` validates against the same seeded set instead of only the admin ids; weights unchanged.
- `ConcoursChallenge.tsx` is reworked and slimmed: remove admin tagging/search state, remove the explicit check-in block, add scored-set marking, auto-advance and auto-exit. Target a meaningfully shorter component split into a small `ConcoursScoreSheet` child.
- No database schema change is required; scores, weights and RLS/guard triggers stay as they are.
