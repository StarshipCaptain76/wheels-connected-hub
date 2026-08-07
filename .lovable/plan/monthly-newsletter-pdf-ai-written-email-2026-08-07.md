# Monthly newsletter (PDF + AI-written email)

Admins upload a monthly newsletter PDF, add their own notes/instructions, let AI draft a fun club-style email around it, review/edit, then send it to subscribers with the PDF attached. The same write-up appears on the home page with a view/download link.

## What the admin does

1. Admin portal → Newsletter → "New edition".
2. Pick month + year (first edition: July 2026), upload the PDF.
3. Optional box: extra content, context, requirements or instructions for the AI ("mention the Riversdal run", "keep it short", etc.).
4. Press "Draft with AI" — the PDF is read and an email is written in the club's voice: friendly, app-style, addressed to club members and anyone who finds wheels interesting, signed off by the Chief Mechanic and his crew. Both EN and AF drafts are produced.
5. Admin edits the draft freely, saves, sends a test to admin, then sends to all active subscribers with the PDF attached.
6. Publishing the edition puts the same text on the home page with View / Download buttons.

## Home page

New "From the workshop" section showing the latest published edition: month badge (e.g. JULY 2026), the email intro text, and View PDF / Download buttons. Older editions reachable from a "Past newsletters" link. Text follows the site's EN/AF toggle.

## Technical notes

- New table `newsletter_editions`: id, year, month, title/intro/body in EN + AF, admin notes, pdf path, status (draft/sent/published), sent_at, published_at, counts. Admin-only write; public read of published editions only (with GRANTs for anon/authenticated/service_role).
- New private storage bucket `newsletters`; PDFs served via a public route that streams a signed URL, so the home page link works for anyone.
- AI drafting: new server function using the Lovable AI gateway (Gemini), sending the PDF as a base64 `file` block plus the admin's instructions, returning EN and AF drafts. Same auth/admin-check pattern as existing newsletter functions.
- Sending reuses the existing Resend send loop in `src/lib/newsletter.functions.ts`, extended with a PDF attachment (base64 from storage) and the existing unsubscribe footer/List-Unsubscribe header.
- Admin UI extends `src/routes/_authenticated/admin/newsletter.tsx` with an Editions tab; existing ad-hoc send stays as-is.
- Reuses existing translate button component for manual EN/AF tweaks.
