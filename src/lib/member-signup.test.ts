import { readFileSync } from 'node:fs';

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const migration = readFileSync(new URL('../../drizzle/migrations/0014_auto_approve_new_members.sql', import.meta.url), 'utf8');
assert(/ALTER COLUMN membership_status SET DEFAULT 'active'/.test(migration), 'New profiles default to active membership');
assert(/INSERT INTO public\.profiles \(id, display_name, membership_status\)[\s\S]*?VALUES \(NEW\.id,[\s\S]*?, 'active'\)/.test(migration), 'New auth signups explicitly receive active membership');
assert(/VALUES \(NEW\.id, 'member'\)/.test(migration), 'New signups receive the member role, not automatic admin privileges');
assert(migration.includes('grant_admin_if_allowlisted(NEW.id, NEW.email, NEW.email_confirmed_at)'), 'Admin assignment retains verified-email allowlist');
console.log('member-signup rules ok');