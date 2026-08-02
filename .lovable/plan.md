## Goal

On phones, the day/night and English/Afrikaans toggles should sit next to the JW logo in the top bar instead of being buried in the hamburger menu, and the header should clear the camera notch/bezel.

## 1. Toggles beside the logo (mobile)

In `src/components/SiteLayout.tsx` header:

- Add a compact toggle group immediately right of the logo link, visible only below the `lg` breakpoint: `ThemeToggle` + `LangToggle`.
- Remove the `ThemeToggle` and `LangToggle` from the hamburger menu's bottom row (that row keeps only the sign-in / account affordance), so there is no duplicate control.
- Keep the existing desktop toggles on the right-hand side (currently `hidden md:block`); change them to `hidden lg:block` so they don't appear twice on tablet widths where the hamburger is still shown.
- Right side on mobile keeps: notification bell + hamburger button.
- If the toggles feel cramped at 360px, they render icon-only/compact (small square buttons) while desktop keeps the current appearance.

## 2. Safe-area top padding

- Update the viewport meta in `src/routes/__root.tsx` to `width=device-width, initial-scale=1, viewport-fit=cover` (required for `env(safe-area-inset-*)` to report real values).
- Add top padding driven by the safe-area inset to the sticky site header so content sits below the camera bezel, e.g. `padding-top: env(safe-area-inset-top)` on the header element (a small utility class in `src/styles.css`, so the value is `0` on devices without an inset and non-zero on notched phones).
- Apply the same treatment to the admin sub-header bar's sticky offset so the two bars stay stacked correctly.
- Also add bottom safe-area padding to the footer's last row to avoid the home-indicator overlap on iOS.

## Verification

Load the site at a 390x844 mobile viewport in a headless browser, confirm the toggles are visible beside the logo, that they work (theme + language switch), that the hamburger no longer contains them, and screenshot the header.
