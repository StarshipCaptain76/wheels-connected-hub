## Goal
Rework the exhibition display board PDF (`src/lib/display-board.ts`) to a 600 × 400 mm landscape sheet on a clean white background, no dark banners.

## Format change
- Page: `format: [600, 400]`, `orientation: "landscape"` (mm).
- Background: pure white. Remove the black header band and black footer band entirely.
- Palette: ink `#140e0c` for text, club red `#cc2222` for accents/rules, light grey hairlines for table separators.

## New landscape layout
```text
┌───────────────────────────────────────────────────────────┐
│ [logo]  JUST WHEELS HESSEQUA            member #0042  ┃   │  header row (text only, red rule under)
├───────────────────────────┬───────────────────────────────┤
│                           │  1968 FORD MUSTANG            │
│      HERO PHOTO           │  "Nickname" · Owner · Town    │
│      (left ~55%)          │  ───────── red rule ───────── │
│                           │  SPEC TABLE (2 columns)       │
│                           │  ENGINE      302 V8           │
│                           │  POWER       224 kW           │
├───────────────────────────┴───────────────────────────────┤
│ [owner portrait]  justwheels.co.za            [club logo] │  footer row, white, thin top rule
└───────────────────────────────────────────────────────────┘
```

## Details
- Header: club wordmark left in ink, "HESSEQUA" in red, member number right; thin red rule beneath instead of a filled band.
- Hero photo: left panel, cover-cropped to the panel ratio, thin ink border. If no photo, a light grey placeholder rectangle (no black fill).
- Title block: make/model auto-shrinks to fit the right column; year in red beside/under it.
- Spec table: fills the right column, single or two sub-columns depending on row count, auto-sized row height so it never overflows the footer. Same bilingual EN/AF labels as today.
- No-specs fallback: vehicle story auto-scaled into the right column, same as current behaviour.
- Footer: white with a thin rule, owner circular portrait (moved from header), `justwheels.co.za`, and the circular club logo right.
- Everything else (`boardHasSpecs`, download filename, low-res warning return value, callers in the profile/member card) stays unchanged, so no call-site edits are needed.

## Technical notes
- All work is confined to `src/lib/display-board.ts`; constants `W`/`H` become 600/400 and every y-coordinate is recomputed for the shorter page.
- Image crop helpers (`coverJpeg`, `circlePng`) are reused; the black canvas fill in `coverJpeg` becomes white.
