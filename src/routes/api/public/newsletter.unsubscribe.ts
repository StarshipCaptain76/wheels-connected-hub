import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/newsletter/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const page = (title: string, body: string) =>
          new Response(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <title>${title}</title>
              <style>
                body{font-family:system-ui,Arial,sans-serif;background:#f5f1e8;color:#111;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
                .card{max-width:480px;background:#fff;border:2px solid #111;border-radius:8px;box-shadow:6px 6px 0 #c1121f;padding:32px;text-align:center}
                h1{font-size:22px;margin:0 0 12px;letter-spacing:1px;text-transform:uppercase}
                p{margin:0 0 20px;color:#333;line-height:1.5}
                a{display:inline-block;background:#111;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold}
              </style>
            </head><body><div class="card"><h1>${title}</h1><p>${body}</p><a href="https://justwheels.co.za/">Back to Just Wheels</a></div></body></html>`,
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );

        if (!token || !/^[0-9a-f-]{10,}$/i.test(token)) {
          return page("Invalid link", "This unsubscribe link is not valid.");
        }

        const { elevated } = await import("@/lib/elevated.server");
        const sb = await elevated();
        const { data: email, error } = await sb.rpc("newsletter_unsubscribe", { _token: token });
        const data = email ? { email: email as string } : null;

        if (error || !data) {
          return page("Not found", "We couldn't find that subscription. It may have already been removed.");
        }
        return page("Unsubscribed", `${data.email} has been removed from the mailing list.`);
      },
      // Some email clients POST list-unsubscribe
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("Missing token", { status: 400 });
        const { elevated } = await import("@/lib/elevated.server");
        const sb = await elevated();
        await sb.rpc("newsletter_unsubscribe", { _token: token });
        return new Response("OK");
      },
    },
  },
});
