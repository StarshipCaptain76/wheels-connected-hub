import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { birthdaySchema } from './member-birthday';

export const getMemberBirthday = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from('member_birthdays')
      .select('birthday_day,birthday_month').eq('user_id', data.userId ?? context.userId).maybeSingle();
    if (error) throw new Error('Could not load birthday.');
    return row ? { day: row.birthday_day, month: row.birthday_month } : null;
  });
export const saveMemberBirthday = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid().optional(), birthday: birthdaySchema.nullable() }).parse(i))
  .handler(async ({ context, data }) => {
    const userId = data.userId ?? context.userId;
    // The owner/admin policy validates both target and saved row.
    const result = data.birthday
      ? await context.supabase.from('member_birthdays').upsert({ user_id: userId, birthday_day: data.birthday.day, birthday_month: data.birthday.month })
      : await context.supabase.from('member_birthdays').delete().eq('user_id', userId);
    if (result.error) throw new Error('Could not save birthday.');
    return { ok: true };
  });