import { z } from 'zod';
export const announcementSchema = z.object({
  requestId: z.string().uuid(),
  titleEn: z.string().trim().min(1).max(120), bodyEn: z.string().trim().min(1).max(2000),
  titleAf: z.string().trim().max(120).optional(), bodyAf: z.string().trim().max(2000).optional(),
});
export function assertAnnouncementAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error('Only admins can send member announcements.');
}