export type LeaderCandidate = { id: string; score: number | null };

/** Retain a recorded draw while the exact tied pool is unchanged. */
export function chooseCompetitionLeader(candidates: LeaderCandidate[], previous: { id: string; score: number; ids: string[] } | null, random = Math.random) {
  const scored = candidates.filter((v) => v.score != null && Number.isFinite(v.score));
  const best = Math.max(...scored.map((v) => v.score ?? -Infinity));
  const ids = scored.filter((v) => v.score === best).map((v) => v.id).sort();
  if (!ids.length) return null;
  const unchanged = previous?.score === best && previous.ids.join() === ids.join() && ids.includes(previous.id);
  const id = unchanged ? previous.id : ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
  return { id, score: best, ids };
}