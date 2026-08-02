## Gallery tagging reliability fix

### Confirmed cause
The hosted backend is healthy. Gallery tagging fails because ordinary member actions unnecessarily call the privileged backend client:
- Loading photo tags calls `profilesByIds()`, which requires `SUPABASE_SERVICE_ROLE_KEY`.
- Adding a tag successfully writes through the signed-in member client, but then `profileEmail()` requires the privileged key; that follow-up failure makes the UI report the whole action as failed.
- Email-invite duplicate/rate-limit checks also use the privileged client even though existing row-level permissions already allow the member-scoped queries.

This explains why rebinding the key temporarily helps but the same user-facing error keeps returning.

### Implementation
1. **Restore the managed backend bindings**
   - Rebind the canonical runtime variables and confirm both the backend URL and privileged key are available to server functions.

2. **Remove unnecessary privileged-key dependencies from gallery tagging**
   - Use the authenticated request client for tag lists, member profile display data, invite checks, invite logging, and the current member’s display name.
   - Obtain the signed-in member’s email from verified auth claims when needed for an invite reply address.
   - Keep the privileged client only for the targeted in-app notification write, where elevated access is genuinely required.

3. **Make notification delivery fail-soft**
   - A missing privileged key or notification error must not undo or falsely report a successful photo tag.
   - Log notification failures server-side while returning success for the completed tag operation.

4. **Prevent misleading retries and duplicate actions**
   - Refresh the tag list after a successful write using the authenticated path.
   - Return clear member-friendly errors only when the actual tag insert/remove fails, not when optional notification delivery fails.

5. **Verify the full flow**
   - Test opening the tagger, loading the member list, adding a tag, undoing/removing it, and sending an email invite while signed in.
   - Confirm the gallery no longer shows the “connect backend” error and that tag state remains correct after refresh.