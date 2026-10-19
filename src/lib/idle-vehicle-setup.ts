export type IdleVehicleDraft = { year: string; make: string; model: string; powertrain: string };
export function parseIdleVehicleYear(value: string): number | null {
  if (!value.trim()) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1886 && year <= 2100 ? year : null;
}
export function updateIdleVehicleDraft(drafts: Record<string, IdleVehicleDraft>, id: string, draft: IdleVehicleDraft) {
  return { ...drafts, [id]: draft };
}