import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { announcementSchema, assertAnnouncementAdmin } from './announcements';

export const sendMemberAnnouncement = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => announcementSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError) throw new Error('Could not verify admin access.');
    assertAnnouncementAdmin(Boolean(admin));
    const { data: sent, error } = await context.supabase.rpc('send_member_announcement', {
      _request_id: data.requestId, _title_en: data.titleEn, _body_en: data.bodyEn,
      _title_af: data.titleAf || undefined, _body_af: data.bodyAf || undefined,
    });
    if (error) throw new Error('Announcement could not be sent. Please retry.');
    return { sent: Number(sent ?? 0) };
  });