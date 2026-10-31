import assert from 'node:assert/strict';
import { birthdayNoticeKey } from './birthday-email.server';

const event = { member_id: 'max', notice_date: '2026-10-31', recipient_email: 'admin@example.com' };
assert.equal(birthdayNoticeKey(event), birthdayNoticeKey({ ...event }), 'Retries use the same delivery key');
assert.notEqual(birthdayNoticeKey(event), birthdayNoticeKey({ ...event, recipient_email: 'other@example.com' }), 'Each admin receives their own notice');
assert.notEqual(birthdayNoticeKey(event), birthdayNoticeKey({ ...event, notice_date: '2027-10-31' }), 'Next birthday is not suppressed');
console.log('birthday-email delivery rules ok');