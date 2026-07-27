
# Global Admin Rights for Two Emails

Grant `admin` role to `admin@justwheels.co.za` and `dawie@polka.co.za` on every sign-in, and keep all other users limited to their own profile/listings/photos (already enforced by existing RLS).

## Current state (verified)

- `public.user_roles` + `public.has_role(uuid, app_role)` already exist. All admin-gated policies (listings moderation, sponsors, newsletter, listing_contacts, listing_photos, profiles admin read/update) use `has_role(auth.uid(), 'admin')`.
- `public.handle_new_user()` currently inserts `'member'` for every new signup. There is no trigger that grants `admin` based on email, and no backfill for existing users.
- Non-admin users are already correctly scoped: `listings_owner_*`, `listing_photos_owner_*`, `profiles_update_own`, etc.

So the only gap is: these two specific emails are not guaranteed to hold the `admin` role.

## Migration (schema + backfill in one file)

1. **New security-definer function** `public.grant_admin_if_allowlisted(_user_id uuid, _email text, _confirmed_at timestamptz)`:
   - Hardcoded allowlist: `admin@justwheels.co.za`, `dawie@polka.co.za` (lowercased compare).
   - Only grants when `_confirmed_at is not null` (prevents the "sign up with someone else's email" privilege-escalation vector — see email-domain-role-assignment guidance).
   - `INSERT INTO public.user_roles(user_id, 'admin') ON CONFLICT DO NOTHING`.

2. **Update `public.handle_new_user()`** to additionally call `grant_admin_if_allowlisted(NEW.id, NEW.email, NEW.email_confirmed_at)` after the existing member insert. Keeps existing member-role behavior for everyone else.

3. **New trigger `on_auth_user_confirmed_grant_admin`** on `auth.users` `AFTER UPDATE OF email_confirmed_at` (when it transitions from null → not null) that calls the same function. Covers Google-OAuth first-login and delayed email confirmation.

4. **Backfill** in the same migration:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT u.id, 'admin'::app_role
   FROM auth.users u
   WHERE lower(u.email) IN ('admin@justwheels.co.za','dawie@polka.co.za')
     AND u.email_confirmed_at IS NOT NULL
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

No code changes required — the existing admin UI (`/admin/classifieds`, `/admin/newsletter`, etc.) is already gated on `has_role(..., 'admin')` and will light up automatically for these two accounts on next sign-in.

## Verification

- `SELECT u.email, r.role FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id WHERE lower(u.email) IN ('admin@justwheels.co.za','dawie@polka.co.za');` → both rows show `admin`.
- Confirm non-admin users still only see their own listings via existing `listings_owner_read_own` policy (no change).

## Notes

- Allowlist is intentionally hardcoded in SQL, not a table, so it can't be modified from the app UI (safer). If you later want a UI to add/remove admins, we'd add a small admin-only management screen — say the word.
- No client/RLS changes needed; ownership scoping for regular users is already in place.
