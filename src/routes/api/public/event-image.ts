import { createFileRoute } from "@tanstack/react-router";

/**
 * Stable image endpoint for event cover / hero images.
 *
 * Event images live in the private `gallery` bucket, so browsers cannot load
 * them directly and signed URLs expire (and need the service key). This route
 * streams the bytes with a plain, cacheable URL that never expires.
 *
 * GET /api/public/event-image?id=<eventId>&k=cover|hero
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
  const id = url.searchParams.get("id");
  const kind = url.searchParams.get("k") === "hero" ? "hero" : "cover";

  if (!id || !/^[0-9a-f-]{32,36}$/i.test(id)) {
    return new Response("Bad request", { status: 400 });
  }

  const { createPublicSupabase } = await import("@/lib/public-supabase.server");
  const anon = createPublicSupabase();

  const { data: event } = await anon
    .from("events")
    .select("id, cover_url, hero_image_url, is_published")
    .eq("id", id)
    .maybeSingle();

  let row = event as
    | { cover_url: string | null; hero_image_url: string | null }
    | null;

  // Unpublished events are hidden from the anon policy — fall back to admin.
  if (!row && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("events")
        .select("cover_url, hero_image_url")
        .eq("id", id)
        .maybeSingle();
      row = (data as typeof row) ?? null;
    } catch (e) {
      console.error("[event-image] admin lookup failed", e);
    }
  }

  const stored = kind === "hero" ? row?.hero_image_url : row?.cover_url;
  const ref = parsePath(stored ?? null);
  if (!ref) return new Response("Not found", { status: 404 });

  let blob: Blob | null = null;
  const { data: dl } = await anon.storage.from(ref.bucket).download(ref.path);
  if (dl) {
    blob = dl as Blob;
  } else if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin.storage.from(ref.bucket).download(ref.path);
      if (data) blob = data as Blob;
    } catch (e) {
      console.error("[event-image] admin download failed", e);
    }
  }

  if (!blob) return new Response("Not found", { status: 404 });

  const ext = (ref.path.split(".").pop() ?? "").toLowerCase();
  const type = blob.type && blob.type !== "application/octet-stream"
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

export const Route = createFileRoute("/api/public/event-image")({
  server: { handlers: { GET: ({ request }) => handle(request) } },
});
