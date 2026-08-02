/** Stable, non-expiring URL for an event's cover / hero image. */
export function eventImageUrl(eventId: string, kind: "cover" | "hero" = "cover"): string {
  return `/api/public/event-image?id=${encodeURIComponent(eventId)}&k=${kind}`;
}

/** True when a stored URL points at one of our private storage buckets. */
export function isPrivateStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/object\/(?:public|sign|authenticated)\/(gallery|garage|listings|sponsors)\//.test(url);
}
