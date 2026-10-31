import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export type CompetitionLeader = {
  competition: 'concours' | 'idle'; vehicleId: string; label: string; labelAf: string | null;
  score: number; submissionCount: number; tiedCount: number; drawnAt: string | null;
};
const input = (i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i);
async function readLeaders(sb: SupabaseClient<Database>, eventId: string, includeIdle: boolean): Promise<CompetitionLeader[]> {
  let query = sb.from('competition_leaders').select('*').eq('event_id', eventId);
  if (!includeIdle) query = query.eq('competition', 'concours');
  const { data: rows, error } = await query;
  if (error) throw new Error('Could not load live leaders.');
  if (!rows?.length) return [];
  const { data: cars, error: carError } = await sb.from('event_concours_vehicles')
    .select('id,label,label_af,sort_order').in('id', rows.map(r => r.vehicle_id));
  if (carError) throw new Error('Could not load leader vehicles.');
  return rows.map(row => {
    const car = cars?.find(c => c.id === row.vehicle_id);
    return { competition: row.competition === 'idle' ? 'idle' : 'concours', vehicleId: row.vehicle_id,
      label: car?.label || `Car ${(car?.sort_order ?? 0) + 1}`, labelAf: car?.label_af ?? null,
      score: row.competition === 'idle' ? 10 : Number(row.score), submissionCount: row.submission_count,
      tiedCount: row.tied_vehicle_ids.length, drawnAt: row.drawn_at };
  });
}
export const getPublicCompetitionLeaders = createServerFn({ method: 'GET' }).inputValidator(input).handler(async ({ data }) => {
  const { createPublicSupabase } = await import('./public-supabase.server');
  return readLeaders(createPublicSupabase(), data.eventId, false);
});
export const getMemberCompetitionLeaders = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(input).handler(async ({ context, data }) => {
  // RLS restricts Rolls-Royce summaries to active members and admins.
  return readLeaders(context.supabase, data.eventId, true);
});