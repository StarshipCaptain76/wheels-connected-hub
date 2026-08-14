/** Concours Mini is open on SAST calendar days from starts_at through ends_at (inclusive). */

export const CONCOURS_TZ = "Africa/Johannesburg";

export function sastDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: CONCOURS_TZ });
}

export type ConcoursPhase = "before" | "open" | "after";

export function concoursPhase(
  startsAt: string,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): ConcoursPhase {
  const start = sastDateKey(startsAt);
  const end = sastDateKey(endsAt || startsAt);
  const today = sastDateKey(now);
  if (!start || !today) return "before";
  if (today < start) return "before";
  if (today > (end || start)) return "after";
  return "open";
}

export function isConcoursWindowOpen(
  startsAt: string,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return concoursPhase(startsAt, endsAt, now) === "open";
}
