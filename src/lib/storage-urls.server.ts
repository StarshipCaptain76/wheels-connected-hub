// Server-only helpers for converting stored Supabase Storage URLs (or raw
// object paths) into short-lived signed URLs. The `gallery` and `garage`
// buckets are private, so objects must never be served through
// /object/public/ links.

const PRIVATE_BUCKETS = new Set(["gallery", "garage", "listings", "sponsors"]);

export type StorageRef = { bucket: string; path: string };

/** Parse a Supabase storage URL into { bucket, path }. Returns null if not one. */
export function parseStorageUrl(url: string | null | undefined): StorageRef | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const bucket = m[1];
  const path = decodeURIComponent(m[2].split("?")[0]);
  return { bucket, path };
}

/**
 * Sign a batch of object paths in one bucket.
 * Returns a Map keyed by path.
 */
export async function signPaths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bucket: string,
  paths: string[],
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(unique, ttlSeconds);
    if (error) console.error(`[storage] sign ${bucket} failed`, error.message);
    for (const row of data ?? []) {
      if (row?.path && row?.signedUrl) map.set(row.path, row.signedUrl);
    }
  } catch (e) {
    console.error(`[storage] sign ${bucket} threw`, e);
  }
  return map;
}

/**
 * Re-sign stored URLs that point at a private bucket. URLs from other
 * origins/buckets are returned unchanged.
 */
export async function signStoredUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  urls: (string | null | undefined)[],
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byBucket = new Map<string, Map<string, string[]>>(); // bucket -> path -> original urls
  for (const url of urls) {
    if (!url) continue;
    const ref = parseStorageUrl(url);
    if (!ref || !PRIVATE_BUCKETS.has(ref.bucket)) continue;
    const bucketMap = byBucket.get(ref.bucket) ?? new Map<string, string[]>();
    const list = bucketMap.get(ref.path) ?? [];
    list.push(url);
    bucketMap.set(ref.path, list);
    byBucket.set(ref.bucket, bucketMap);
  }
  for (const [bucket, bucketMap] of byBucket) {
    const signed = await signPaths(supabase, bucket, [...bucketMap.keys()], ttlSeconds);
    for (const [path, originals] of bucketMap) {
      const s = signed.get(path);
      if (!s) continue;
      for (const o of originals) out.set(o, s);
    }
  }
  return out;
}

/** Convenience for a single stored URL. */
export async function signStoredUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  url: string | null | undefined,
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<string | null> {
  if (!url) return null;
  const map = await signStoredUrls(supabase, [url], ttlSeconds);
  return map.get(url) ?? url;
}
