import { createFileRoute } from "@tanstack/react-router";

/**
 * Stable image endpoint for concours vehicle photos.
 *
 * Photos live in the private `gallery` bucket but are stored as plain
 * /object/public/… URLs, which the browser cannot load. This route streams the
 * bytes from a cacheable URL that never expires.
 *
 * GET /api/public/concours-image?vid=<vehicleId>
 */

function parsePath(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2].split("?")[0]) };
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

async function handle(request: Request) {
  const url = new URL(request.url);
  const vid = url.searchParams.get("vid");
  if (!vid || !/^[0-9a-f-]{32,36}$/i.test(vid)) {
    return new Response("Bad request", { status: 400 });
  }

  const { createPublicSupabase } = await import("@/lib/public-supabase.server");
  const anon = createPublicSupabase();

  const { data: row } = await anon
    .from("event_concours_vehicles")
    .select("photo_url")
    .eq("id", vid)
    .maybeSingle();
  const stored = (row as { photo_url?: string } | null)?.photo_url ?? null;

  const ref = parsePath(stored);
  if (!ref) {
    // Not a storage URL — if it is an absolute external image, redirect.
    if (stored && /^https?:\/\//i.test(stored)) {
      return Response.redirect(stored, 302);
    }
    return new Response("Not found", { status: 404 });
  }

  const { data: dl, error } = await anon.storage.from(ref.bucket).download(ref.path);
  const blob = (dl as Blob | null) ?? null;
  if (!blob) {
    console.error("[concours-image] download failed", ref.path, error?.message);
    return new Response("Not found", { status: 404 });
  }

  const ext = (ref.path.split(".").pop() ?? "").toLowerCase();
  const type =
    blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : (CONTENT_TYPES[ext] ?? "image/jpeg");

  return new Response(await blob.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export const Route = createFileRoute("/api/public/concours-image")({
  server: { handlers: { GET: ({ request }) => handle(request) } },
});
