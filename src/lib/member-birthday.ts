import { z } from 'zod';
export const birthdaySchema = z.object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }).refine(v => v.day <= new Date(Date.UTC(2000, v.month, 0)).getUTCDate(), 'Choose a valid birthday day and month.');
export function birthdayIsToday(birthday: { month: number; day: number }, now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Johannesburg', month: 'numeric', day: 'numeric' }).formatToParts(now);
  return birthday.month === Number(parts.find(p => p.type === 'month')?.value) && birthday.day === Number(parts.find(p => p.type === 'day')?.value);
}