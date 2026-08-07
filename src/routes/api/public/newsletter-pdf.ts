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

  if (!id || !/^[0-9a-f-]{32,36}$/i.test(id)) {
    return new Response("Bad request", { status: 400 });
  }

  const { createPublicSupabase } = await import("@/lib/public-supabase.server");
  const anon = createPublicSupabase();

  const { data: row } = await anon
    .from("newsletter_editions")
    .select("pdf_path, year, month, is_published")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  const edition = row as
    | { pdf_path: string | null; year: number; month: number }
    | null;
  if (!edition?.pdf_path) return new Response("Not found", { status: 404 });

  const { data: blob } = await anon.storage.from("newsletters").download(edition.pdf_path);
  if (!blob) return new Response("Not found", { status: 404 });

  const name = `Just-Wheels-${edition.year}-${String(edition.month).padStart(2, "0")}.pdf`;

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
