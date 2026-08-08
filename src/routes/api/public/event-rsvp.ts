import { createFileRoute } from "@tanstack/react-router";

const VALID = ["going", "maybe", "not_going"] as const;
type Resp = (typeof VALID)[number];

function page(title: string, body: string, eventId?: string) {
  const link = eventId ? `https://www.justwheels.co.za/events/${eventId}` : "https://www.justwheels.co.za/";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${title}</title>
      <style>
        body{font-family:system-ui,Arial,sans-serif;background:#f5f1e8;color:#111;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
        .card{max-width:480px;background:#fff;border:2px solid #111;border-radius:8px;box-shadow:6px 6px 0 #c1121f;padding:32px;text-align:center}
        h1{font-size:22px;margin:0 0 12px;letter-spacing:1px;text-transform:uppercase}
        p{margin:0 0 20px;color:#333;line-height:1.5}
        a{display:inline-block;background:#111;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:bold}
      </style>
    </head><body><div class="card"><h1>${title}</h1><p>${body}</p><a href="${link}">View the event</a></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

const LABEL: Record<Resp, string> = {
  going: "You're going",
  maybe: "Marked as maybe",
  not_going: "Marked as not going",
};

async function handle(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const r = url.searchParams.get("r") as Resp | null;

  if (!token || !/^[0-9a-f-]{20,}$/i.test(token) || !r || !VALID.includes(r)) {
    return page("Invalid link", "This RSVP link is not valid. Open the event on the website to reply.");
  }

  const { elevated } = await import("@/lib/elevated.server");
  const sb = await elevated();
  const { data: eventId, error } = await sb.rpc("rsvp_via_invite", { _token: token, _response: r });

  if (error) {
    console.error("[event-rsvp] rsvp failed", error);
    return page("Something went wrong", "We couldn't save your answer. Please try the event page.");
  }
  if (!eventId) {
    return page("Link not found", "We couldn't find that invite. It may have been removed.");
  }
  const invite = { event_id: eventId as string };

  return page(
    LABEL[r],
    r === "going"
      ? "Thanks! We've marked you as going. See you there."
      : "Thanks for letting us know — your answer has been saved.",
    invite.event_id,
  );
}

export const Route = createFileRoute("/api/public/event-rsvp")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
