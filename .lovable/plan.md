## Goal

When a member signs in and their profile is missing information, show them exactly what is missing and walk them through a short wizard to fill it in. Skipping is allowed, but a reminder stays until the profile is complete.

## What counts as "complete"

Five things, all already stored on the member profile:

1. Full name
2. Phone number
3. Town
4. Profile photo
5. Favourite ride
6. Short bio (the one used when they are the featured member)

## Member experience

On the members home page only:

- If anything is missing, a red-bordered card appears at the top: "Your profile is X% complete" with a plain-language list of what is still needed and a big **COMPLETE MY PROFILE** button.
- The wizard opens automatically the first time they land on the page in a session; after that the card stays but does not pop up again.
- The wizard is one question per screen with a progress dot row, Back / Next, and a **Skip for now** link. It only shows the steps that are actually missing.
- Photo step reuses the existing avatar upload.
- Last screen confirms "All done" and closes back to the profile page.
- Everything bilingual (English / Afrikaans), matching the existing club styling.

```text
+------------------------------------------+
|  YOUR PROFILE IS 60% COMPLETE            |
|  Still needed: photo, town, short bio    |
|  [ COMPLETE MY PROFILE ]   skip for now  |
+------------------------------------------+
```

## Technical notes

- New `src/lib/profile-completeness.ts`: pure helper returning missing field keys + percentage from a `MemberProfile`; shared by the banner and the wizard.
- New `src/components/ProfileWizard.tsx`: modal stepper, one field per step, saves through the existing `updateMyProfile` server function (and `updateMyAvatar` for the photo step, same upload logic as `GarageManager`). Saves each step as you advance so partial progress is never lost.
- New `src/components/ProfileCompletionBanner.tsx`: the summary card + open button.
- `src/routes/_authenticated/members.index.tsx`: render the banner above the existing content, auto-open the wizard once per session (`sessionStorage` flag), invalidate the `["profile","me"]` query on save so the member card preview updates immediately.
- Translation keys added to the existing i18n dictionary.
- No database or schema changes needed — all fields already exist on `profiles`.
