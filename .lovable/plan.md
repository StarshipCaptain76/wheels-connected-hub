## Goal

Members can download a printable **600 × 900 mm portrait display board** PDF for a vehicle in their garage — the kind propped next to the car at exhibitions — modelled on the attached Cobra board.

## 1. Vehicle spec fields (database)

Add optional columns to `garage_vehicles` (all nullable text, blank fields are simply omitted from the board):

`built_by`, `engine`, `power`, `torque`, `acceleration`, `quarter_mile`, `top_speed`, `fuel_economy`, `transmission`, `diff_ratio`, `suspension_front`, `suspension_rear`, `brakes_front`, `brakes_rear`, `wheels_tyres`, `car_size`, `car_weight`, plus a free-text `extra_notes`.

Existing vehicles keep their `story` text untouched; the board falls back to nothing if the new fields are empty. (Your Cobra's specs currently live in the story text — you can paste them into the new fields once.)

## 2. Garage editor UI

In `GarageManager.tsx`, add a collapsible **"Spec sheet (for display board)"** section to the vehicle form with the fields above, bilingual labels, all optional.

## 3. Board layout (PDF)

New `src/lib/display-board.ts` using **jsPDF** (added as a dependency), page size 600 × 900 mm portrait:

```text
┌──────────────────────────────────┐
│ [member photo]        JUST WHEELS│  header band
│                        HESSEQUA  │
├──────────────────────────────────┤
│                                  │
│      vehicle hero photo          │  ~45% of height
│                                  │
├──────────────────────────────────┤
│  MAKE MODEL            YEAR      │  big display title
│  "Nickname"  ·  Owner name       │
├──────────────────────────────────┤
│  Engine        │ …               │
│  Power         │ …               │  two-column spec table,
│  Torque        │ …               │  only rows with values
│  …             │ …               │
├──────────────────────────────────┤
│  member no. · town        [LOGO] │  footer, club roundel bottom-right
└──────────────────────────────────┘
```

- Red hairline rules and the club red accent, matching the app's tokens and the sample board's restraint.
- Member photo top-left (circular crop), Just Wheels roundel bottom-right.
- Type sized for readability at 2–3 m (spec labels ≈ 18 pt at print scale, headline ≈ 90 pt).
- Text is language-aware (EN/AF) using the current app language.
- Images are fetched and embedded; a low-resolution photo triggers a soft warning toast rather than a failure.

## 4. Where the download appears

- **Member profile → each vehicle card in the garage**: a "Download display board (PDF)" button.
- **`/members/card` (member card page)**: same button for the primary vehicle, next to the existing card actions, so it sits alongside the laminate card download.
- Button is disabled with a hint when the vehicle has no photo.

## Technical notes

- jsPDF runs client-side; no server function needed. Photos are already served over signed/public URLs, fetched as blobs and embedded.
- Very large pages are fine in jsPDF — the PDF stays vector text plus one or two JPEGs, typically a few MB.

## Verification

Generate a board for the Cobra in a headless browser, convert the PDF to an image, and visually check margins, no overlap, correct spec rows, logo and member photo placement.
