import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams a published newsletter PDF.
 *
 * GET /api/public/newsletter-pdf?id=<editionId>[&dl=1]
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const download = url.searchParams.get("dl") === "1";
  const wantAf = url.searchParams.get("lang") === "af";

  if (!id || !/^[0-9a-f-]{32,36}$/i.test(id)) {
    return new Response("Bad request", { status: 400 });
  }

  const { createPublicSupabase } = await import("@/lib/public-supabase.server");
  const anon = createPublicSupabase();

  const { data: row } = await anon
    .from("newsletter_editions")
    .select("pdf_path, pdf_path_af, year, month, is_published")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  const edition = row as
    | { pdf_path: string | null; pdf_path_af: string | null; year: number; month: number }
    | null;
  const path = wantAf ? (edition?.pdf_path_af ?? edition?.pdf_path) : edition?.pdf_path;
  if (!path) return new Response("Not found", { status: 404 });

  const { data: blob } = await anon.storage.from("newsletters").download(path);
  if (!blob) return new Response("Not found", { status: 404 });

  const usedAf = wantAf && !!edition?.pdf_path_af;
  const name = `Just-Wheels-${edition!.year}-${String(edition!.month).padStart(2, "0")}${usedAf ? "-AF" : ""}.pdf`;

  return new Response(await (blob as Blob).arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export const Route = createFileRoute("/api/public/newsletter-pdf")({
  server: { handlers: { GET: ({ request }) => handle(request) } },
});
