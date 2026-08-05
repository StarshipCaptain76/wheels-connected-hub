/** Event invite sending — server only. */
import { buildInviteEmail, type InviteEventData } from "./event-invite-email.server";
import { sendEmail } from "./email.server";

const EVENTS_FROM = "Just Wheels Events <events@notify.justwheels.co.za>";

export type Recipient = {
  userId: string;
  email: string;
  lang: "en" | "af";
  name: string | null;
};

/** Active members with a usable email address. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collectRecipients(client?: any): Promise<Recipient[]> {
  const { elevated } = await import("./elevated.server");
  const supabaseAdmin = await elevated(client);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, preferred_lang, membership_status")
    .eq("membership_status", "active");
  if (!profiles?.length) return [];

  const emails = new Map<string, string>();
  const { data: mailRows } = await supabaseAdmin.from("member_emails").select("user_id, email");
  for (const r of (mailRows ?? []) as Array<{ user_id: string; email: string | null }>) {
    if (r.email) emails.set(r.user_id, r.email);
  }

  const out: Recipient[] = [];
  for (const p of profiles) {
    const email = emails.get(p.id);
    if (!email) continue;
    out.push({
      userId: p.id,
      email,
      lang: p.preferred_lang === "af" ? "af" : "en",
      name: p.display_name ?? null,
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadEvent(eventId: string, client?: any): Promise<InviteEventData> {
  const { elevated } = await import("./elevated.server");
  const supabaseAdmin = await elevated(client);
  const { data: ev, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url, hero_image_url, destination_lat, destination_lng, destination_address",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error || !ev) throw new Error("Event not found");

  const { data: wp } = await supabaseAdmin
    .from("event_waypoints")
    .select("label, label_af, lat, lng, meet_time")
    .eq("event_id", eventId)
    .order("sort", { ascending: true });

  return { ...ev, waypoints: wp ?? [] } as InviteEventData;
}

export async function runEventInvites(
  eventId: string,
  onlyNew: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const { elevated } = await import("./elevated.server");
  const supabaseAdmin = await elevated(client);
  const ev = await loadEvent(eventId, client);
  const recipients = await collectRecipients(client);

  const { data: existing } = await supabaseAdmin
    .from("event_invites")
    .select("user_id, token")
    .eq("event_id", eventId);
  const tokenByUser = new Map((existing ?? []).map((r: { user_id: string; token: string }) => [r.user_id, r.token]));

  const targets = onlyNew ? recipients.filter((r) => !tokenByUser.has(r.userId)) : recipients;
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];

  let sent = 0;
  let failed = 0;

  for (const r of targets) {
    try {
      let token = tokenByUser.get(r.userId);
      if (!token) {
        const { data: row, error } = await supabaseAdmin
          .from("event_invites")
          .insert({ event_id: eventId, user_id: r.userId, email: r.email })
          .select("token")
          .single();
        if (error || !row) throw error ?? new Error("invite insert failed");
        token = row.token as string;
        tokenByUser.set(r.userId, token);
      } else {
        await supabaseAdmin
          .from("event_invites")
          .update({ email: r.email, sent_at: new Date().toISOString() })
          .eq("event_id", eventId)
          .eq("user_id", r.userId);
      }

      const { subject, html } = buildInviteEmail({
        ev,
        token,
        lang: r.lang,
        mapsKey,
        memberName: r.name,
      });
      await sendEmail({ to: [r.email], subject, html, from: EVENTS_FROM });
      sent++;
      await new Promise((res) => setTimeout(res, 120));
    } catch (e) {
      failed++;
      console.error("[event-invites] send failed", r.email, e);
    }
  }

  if (sent > 0) {
    await supabaseAdmin
      .from("events")
      .update({ invites_sent_at: new Date().toISOString(), invites_sent_count: sent })
      .eq("id", eventId);
  }

  return { sent, skipped: recipients.length - targets.length, failed };
}
