import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron hook: sends the day-before reminder for events happening tomorrow.
 * Protected by a private key stored in the database (`cron_secrets`), passed in
 * the request body by the pg_cron job. No service-role key is involved.
 */
async function handle(request: Request) {
  let key = "";
  try {
    const body = (await request.json()) as { key?: string };
    key = body?.key ?? "";
  } catch {
    key = "";
  }
  if (!key) return json({ error: "Missing key" }, 401);

  const { createPublicSupabase } = await import("@/lib/public-supabase.server");
  const { sendEmail, SPONSORS_FROM } = await import("@/lib/email.server");
  const { buildReminderEmail } = await import("@/lib/event-reminder-email.server");
  const sb = createPublicSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: due, error } = await (sb as any).rpc("event_reminders_due", { _key: key });
  if (error) {
    console.error("[event-reminders] due lookup failed", error);
    return json({ error: "Not allowed" }, 401);
  }

  const events = (due ?? []) as Array<{
    event_id: string;
    title: string;
    title_af: string | null;
    location: string | null;
    starts_at: string;
  }>;

  let notified = 0;
  let emailed = 0;

  for (const ev of events) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipients, error: sendErr } = await (sb as any).rpc("send_event_reminder", {
      _key: key,
      _event_id: ev.event_id,
    });
    if (sendErr) {
      console.error("[event-reminders] fan-out failed", ev.event_id, sendErr);
      continue;
    }
    const rows = (recipients ?? []) as Array<{
      email: string;
      lang: string;
      display_name: string | null;
    }>;
    notified += rows.length;

    for (const r of rows) {
      const lang = r.lang === "af" ? "af" : "en";
      const { subject, html } = buildReminderEmail({
        ev: {
          id: ev.event_id,
          title: ev.title,
          title_af: ev.title_af,
          location: ev.location,
          starts_at: ev.starts_at,
        },
        lang,
        memberName: r.display_name,
      });
      try {
        await sendEmail({ to: [r.email], subject, html, from: SPONSORS_FROM });
        emailed += 1;
      } catch (e) {
        console.error("[event-reminders] email failed", r.email, e);
      }
    }
  }

  return json({ ok: true, events: events.length, notified, emailed });
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/event-reminders")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
