## Goal

Replace the two long, fake-mockup admin emails (new member sign-up, new sponsor application) with short, visual emails built around **real mobile screenshots** of the actual admin pages, each screenshot clickable and linking straight to the page it shows.

## What changes for the reader

Current: walls of text, CSS-drawn fake buttons, 4–5 verbose steps.

New shape, same for both emails:

```text
[ red header: what happened + who ]
[ small detail box: name / email ]

  1  Open the approvals page      → [ real mobile screenshot, tappable ]
     one short line of text

  2  Find the orange PENDING row  → [ real mobile screenshot, tappable ]
     one short line of text

  3  Tap the green APPROVE button → [ real mobile screenshot, tappable ]
     one short line of text

[ big black button: OPEN APPROVALS ]
[ plain link URL underneath, for copy/paste ]
```

Rules applied: max one short sentence per step, step number in a red circle beside the picture, every picture wrapped in a link to the live page, phone-width images (max-width 320px, auto-scaling), no fake CSS buttons, no tips paragraph buried at the end (the "approve all pending" tip becomes one line under step 3).

## Screenshots

Capture real mobile-viewport (390px wide) screenshots of `/admin/members` and `/admin/sponsors` as an admin, cropped to the relevant region per step:

- members: page top, a pending row, the approve action
- sponsors: applications block, an application row, the approve dialog

Store them as static files in `public/email/` (e.g. `public/email/members-1.png`), served from `https://justwheels.co.za/email/...` so email clients can load them. Screenshots contain demo/blurred names, not real member PII.

If a page can't be captured cleanly for a step, that step falls back to text-only rather than a fake mockup.

## Technical details

- New `src/lib/email-shot.server.ts`: `shot(step, caption, imgUrl, linkUrl)` helper rendering the numbered row + linked, width-constrained `<img>` with alt text, and `compactShell(kicker, title, body)` for the outer frame.
- Rewrite `src/lib/sponsor-application-email.server.ts` to use it; delete the fake-mockup helpers from `src/lib/email-steps.server.ts` once unused.
- Rewrite the HTML block in `src/lib/member-signup.functions.ts` into a new `src/lib/member-signup-email.server.ts` so the server function stays a thin wrapper.
- Image URLs are absolute against `SITE_ORIGIN`; images use `width`/`style="max-width:320px"` for Gmail/Outlook mobile.
