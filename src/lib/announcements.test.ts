import { assertAnnouncementAdmin, announcementSchema } from './announcements';
let denied = false;
try { assertAnnouncementAdmin(false); } catch { denied = true; }
if (!denied) throw new Error('Non-admin must not be allowed to broadcast');
assertAnnouncementAdmin(true);
const valid = { requestId: '59b148d4-5351-4e7e-81ee-f996e890a8c4', titleEn: 'Club notice', bodyEn: 'Meet at the church.' };
if (!announcementSchema.safeParse(valid).success) throw new Error('Admin announcement accepts a title and message');
if (announcementSchema.safeParse({ ...valid, bodyEn: ' ' }).success) throw new Error('Empty messages must not send');
console.log('announcements ok');