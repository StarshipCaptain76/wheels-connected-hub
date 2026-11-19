import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const sql = read('drizzle/migrations/0015_selected_security_access_guards.sql');
assert(sql.includes('_user_id=auth.uid()'), 'Role checks are self-scoped');
assert(sql.includes('NEW.membership_status IS DISTINCT FROM OLD.membership_status'), 'Membership changes guarded');
assert(sql.includes('tagged_by=auth.uid() OR tagged_user_id=auth.uid()'), 'Only involved members can remove tags');
assert(sql.includes("p.status IN ('open','closed')"), 'Draft poll totals hidden');
assert(sql.includes("_type<>'photo_tag' OR NOT EXISTS"), 'Direct member alerts require real tags');
assert(sql.includes("bucket_id='events' AND public.has_role(auth.uid(),'admin')"), 'Event uploads admin-scoped');
const image = read('src/routes/api/public/event-image.ts');
assert(image.includes('.eq("is_published", true)'), 'Public images require published events');
assert(!image.includes('supabaseAdmin') && !image.includes('SERVICE_ROLE'), 'Image route has no privileged fallback');
for (const path of ['src/lib/event-invites.server.ts','src/routes/api/public/hooks/event-reminders.ts','src/lib/newsletter-editions.functions.ts','src/lib/newsletter.functions.ts']) {
 const source = read(path);
 assert(!source.split('\n').some(line => line.includes('console.error') && /r\.email|s\.email/.test(line)), 'Recipient addresses not logged');
}
console.log('Selected security regression checks passed');