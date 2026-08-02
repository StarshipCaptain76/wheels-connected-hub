import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { parseStorageUrl } from "@/lib/storage-urls.server";

const requestSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["cover", "hero"]).default("cover"),
});

export const Route = createFileRoute("/api/public/event-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = requestSchema.safeParse({
          id: url.searchParams.get("id"),
          kind: url.searchParams.get("kind") ?? "cover",
        });
        if (!parsed.success) return new Response("Invalid request", { status: 400 });

        const { createPublicSupabase } = await import("@/lib/public-supabase.server");
        const publicClient = createPublicSupabase();
        const { data: event, error } = await publicClient
          .from("events")
          .select("cover_url, hero_image_url")
          .eq("id", parsed.data.id)
          .eq("is_published", true)
          .maybeSingle();

        if (error || !event) return new Response("Image not found", { status: 404 });
        const storedUrl =
          parsed.data.kind === "hero" ? event.hero_image_url : event.cover_url;
        const ref = parseStorageUrl(typeof storedUrl === "string" ? storedUrl : null);
        if (!ref) return new Response("Image not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error: downloadError } = await supabaseAdmin.storage
          .from(ref.bucket)
          .download(ref.path);
        if (downloadError || !data) return new Response("Image not found", { status: 404 });

        return new Response(data, {
          headers: {
            "Content-Type": data.type || "application/octet-stream",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});