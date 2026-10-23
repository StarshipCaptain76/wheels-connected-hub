/** Minimum number of concours vehicles before "Vote now" may go live on an event. */
export const MIN_VOTING_VEHICLES = 2;

export function filterVotingReadyEventIds(openEventIds: string[], vehicleCounts: Map<string, number>) {
  return openEventIds.filter((id) => (vehicleCounts.get(id) ?? 0) >= MIN_VOTING_VEHICLES);
}
