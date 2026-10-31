import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const requestSchema = z.object({ key: z.string().min(1).max(512) }).strict();

async function handle(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { createPublicSupabase } = await import('@/lib/public-supabase.server');
  const { sendEmail } = await import('@/lib/email.server');
  const { buildBirthdayEmail, birthdayNoticeKey, BIRTHDAY_FROM } = await import('@/lib/birthday-email.server');
  const sb = createPublicSupabase();
  // The RPC checks the private cron secret before releasing any profile details.
  const { data: notices, error } = await sb.rpc('birthday_admin_notices_due', { _key: parsed.data.key });
  if (error) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const byMember = new Map<string, NonNullable<typeof notices>>();
  for (const notice of notices ?? []) {
    const rows = byMember.get(notice.member_id) ?? [];
    rows.push(notice);
    byMember.set(notice.member_id, rows);
  }
  let sent = 0;
  let failed = 0;
  for (const [memberId, rows] of byMember) {
    let complete = true;
    for (const notice of rows) {
      try {
        await sendEmail({ to: [notice.recipient_email], ...buildBirthdayEmail(notice), from: BIRTHDAY_FROM, idempotencyKey: birthdayNoticeKey(notice) });
        sent++;
      } catch {
        complete = false;
        failed++;
        console.error('[birthday-reminders] Email send failed; notice remains available for retry.');
      }
    }
    const first = rows[0];
    if (complete && first) {
      const { error: markError } = await sb.rpc('complete_birthday_admin_notice', { _key: parsed.data.key, _member_id: memberId, _notice_date: first.notice_date });
      if (markError) failed++;
    }
  }
  return Response.json({ ok: failed === 0, members: byMember.size, sent, failed }, { status: failed ? 503 : 200 });
}

export const Route = createFileRoute('/api/public/hooks/birthday-reminders')({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});