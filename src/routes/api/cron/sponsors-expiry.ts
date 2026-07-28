import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily job: hide sponsors past billing_ends_at and email admin once.
 * Protected by CRON_SECRET (Authorization: Bearer …) or Vercel Cron header.
 */
export const Route = createFileRoute("/api/cron/sponsors-expiry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const secret = process.env.CRON_SECRET;
        const vercelCron = request.headers.get("x-vercel-cron");
        const ok =
          Boolean(vercelCron) ||
          (secret && auth === `Bearer ${secret}`) ||
          (!secret && process.env.NODE_ENV !== "production");

        if (!ok) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { processExpiredSponsors } = await import("@/lib/sponsors-expiry.server");
          const result = await processExpiredSponsors();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[cron/sponsors-expiry]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
