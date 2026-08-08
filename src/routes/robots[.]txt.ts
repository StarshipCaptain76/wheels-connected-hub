import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Canonical, primary origin. Everything else (lovable.app preview hosts) is non-canonical. */
const PRIMARY_ORIGIN = "https://www.justwheels.co.za";
const PRIMARY_HOST = "www.justwheels.co.za";

function requestHost(request: Request): string {
  try {
    const url = new URL(request.url);
    return (
      request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host
    ).toLowerCase();
  } catch {
    return PRIMARY_HOST;
  }
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const host = requestHost(request);
        const isPrimary = host === PRIMARY_HOST;

        // Non-primary hosts (lovable.app, apex) must not be indexed or tracked.
        const body = isPrimary
          ? [
              "User-agent: *",
              "Allow: /",
              "Disallow: /auth",
              "Disallow: /members",
              "Disallow: /admin",
              "",
              `Sitemap: ${PRIMARY_ORIGIN}/sitemap.xml`,
              "",
            ].join("\n")
          : ["User-agent: *", "Disallow: /", ""].join("\n");

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
