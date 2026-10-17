/** Short stable hash so the URL changes whenever the stored image changes (cache-busting). */
function ver(src: string | null | undefined): string {
  if (!src) return "";
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
  return `&v=${(h >>> 0).toString(36)}`;
}

/** Stable, non-expiring URL for an event's cover / hero image. Pass the stored URL to bust caches on change. */
export function eventImageUrl(
  eventId: string,
  kind: "cover" | "hero" = "cover",
  stored?: string | null,
): string {
  return `/api/public/event-image?id=${encodeURIComponent(eventId)}&k=${kind}${ver(stored)}`;
}
/** Stable URL for a concours vehicle photo (streams from the private bucket). */
export function concoursImageUrl(vehicleId: string): string {
  return `/api/public/concours-image?vid=${encodeURIComponent(vehicleId)}`;
}

/** True when a stored URL points at one of our private storage buckets. */
export function isPrivateStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/object\/(?:public|sign|authenticated)\/(gallery|garage|listings|sponsors)\//.test(url);
}
