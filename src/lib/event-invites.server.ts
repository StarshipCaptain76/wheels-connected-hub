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
export async function collectRecipients(): Promise<Recipient[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, preferred_lang, membership_status")
    .eq("membership_status", "active");
  if (!profiles?.length) return [];

  const emails = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) if (u.email) emails.set(u.id, u.email);
    if (users.length < 200) break;
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

async function loadEvent(eventId: string): Promise<InviteEventData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
): Promise<{ sent: number; skipped: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ev = await loadEvent(eventId);
  const recipients = await collectRecipients();

  const { data: existing } = await supabaseAdmin
    .from("event_invites")
    .select("user_id, token")
    .eq("event_id", eventId);
  const tokenByUser = new Map((existing ?? []).map((r) => [r.user_id as string, r.token as string]));

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
