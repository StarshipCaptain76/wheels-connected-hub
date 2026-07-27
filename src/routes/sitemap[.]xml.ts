import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://wheels-connected-hub.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/about", changefreq: "monthly", priority: "0.7" },
          { path: "/events", changefreq: "daily", priority: "0.9" },
          { path: "/gallery", changefreq: "weekly", priority: "0.7" },
          { path: "/classifieds", changefreq: "daily", priority: "0.8" },
          { path: "/shop", changefreq: "monthly", priority: "0.6" },
          { path: "/sponsors", changefreq: "monthly", priority: "0.5" },
          { path: "/join", changefreq: "monthly", priority: "0.8" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
        ];

        try {
          const { createPublicSupabase } = await import("@/lib/public-supabase.server");
          const supabase = createPublicSupabase();
          const { data } = await supabase
            .from("listings")
            .select("id, updated_at")
            .eq("status", "approved")
            .order("updated_at", { ascending: false })
            .limit(500);
          for (const row of data ?? []) {
            entries.push({
              path: `/classifieds/${row.id}`,
              lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch {
          // sitemap should still render even if the DB read fails
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
