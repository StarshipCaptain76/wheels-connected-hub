import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const FALLBACK_BASE_URL = "https://justwheels-hessequa.lovable.app";

function resolveBaseUrl(request: Request): string {
  try {
    const url = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore
  }
  return FALLBACK_BASE_URL;
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const baseUrl = resolveBaseUrl(request);
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /auth",
          "Disallow: /members",
          "Disallow: /admin",
          "",
          `Sitemap: ${baseUrl}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
