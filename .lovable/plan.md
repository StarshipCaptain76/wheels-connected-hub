# Sponsor applications, approval and member-owned sponsor cards

## What changes for people

**A business applies** on `/sponsors`. Today that form only emails the club — nothing is stored. After this change the application is saved, and the applicant immediately gets a confirmation email ("we received your application").

**Admin reviews** at `/admin/sponsors`, in a new "Applications" section above the sponsor list: pending / approved / declined tabs, each showing business, contact, email, phone, website and message. Admin can:
- **Approve** — pick which club member owns this sponsor (searchable member picker, pre-matched by the application email when it matches a member), set subscription start/end dates, and a sponsor record is created in draft (inactive) state. The applicant and assigned member get an email: "Approved — complete your sponsor card setup" with a link to `/members/sponsor`.
- **Decline** — marks it declined (no email sent unless you want one; default: no email).

**The assigned member** gets a new page `/members/sponsor` (linked from the members area when they own a sponsor). While their subscription is valid they can edit the sponsor card: logo, name, tagline (EN/AF, with the existing translate button) and website. When the end date has passed, the form is read-only and shows "Your sponsorship has expired — contact the club admin" with the WhatsApp/email contact. Members can never change dates, active flag, sort order, or ownership — admin-only.

**Public carousel** is unchanged in behaviour: only active sponsors inside their date window are shown.

## Technical details

Database migration:
- `public.sponsor_applications` — business, contact_name, email, phone, website, message, status (`pending` / `approved` / `declined`), reviewed_by, reviewed_at, created_sponsor_id, timestamps. Insert allowed for anon+authenticated (public form); select/update admin-only via `has_role`. GRANTs for anon/authenticated/service_role per policies.
- `public.sponsors` gains `owner_user_id uuid references auth.users`.
- New RLS on sponsors: owners may `SELECT`/`UPDATE` their own row; an `UPDATE` policy plus a trigger restricts owner edits to name/tagline/tagline_af/website_url/logo_path and blocks changes when `billing_ends_at < current_date`. Admin policies stay as-is.
- Storage `sponsors` bucket: extend upload/update policies so a sponsor owner may write under their own `owner_user_id/...` prefix (currently admin-only).

Server functions (`src/lib/sponsors.functions.ts` + new `sponsor-applications.functions.ts`):
- `applySponsor` — keep the admin notification email, add an insert into `sponsor_applications` and a Resend confirmation email to the applicant (from `sponsors@notify.justwheels.co.za`).
- `listSponsorApplications`, `approveSponsorApplication` (assign owner + dates, create sponsor row, send setup email), `declineSponsorApplication` — all admin-gated.
- `getMySponsor` / `updateMySponsor` — `requireSupabaseAuth`, owner-scoped, server-side expiry check.
- Reuse the existing member list from `admin-members.functions.ts` for the owner picker.

UI:
- `src/routes/_authenticated/admin/sponsors.tsx`: applications panel with tabs, approve dialog (member picker + dates), decline action; owner column shown on each sponsor row so admin can reassign.
- New `src/routes/_authenticated/members.sponsor.tsx` with the card editor and expired state; entry point added in the members area only when the user owns a sponsor.
- New EN/AF strings in `src/i18n/dictionaries.ts` for the member-facing page and application confirmation copy.

Emails are all Resend via the existing `RESEND_API_KEY` and the `notify.justwheels.co.za` sender.
