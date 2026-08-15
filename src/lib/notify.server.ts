/**
 * Server-only fan-out helper for in-app notifications.
 * Never throws: notification failures must not block the primary action.
 *
 * Uses the caller's authenticated client with the `fanout_notification`
 * database function. Public admin alerts use the publishable client.
 * Never use the service-role client here: it has no auth.uid(), so the RPC
 * correctly rejects member-facing notification types.
 */

export type NotificationType =
  | "new_listing"
  | "new_event"
  | "event_photo"
  | "new_newsletter"
  | "admin_new_sponsor"
  | "admin_new_member"
  | "admin_listing_review";

export type NotifyPayload = {
  type: NotificationType;
  title_en: string;
  title_af: string;
  body_en?: string | null;
  body_af?: string | null;
  link?: string | null;
  related_id?: string | null;
  /** Do not notify this user (usually the actor who triggered the event). */
  excludeUserId?: string | null;
};

/** Insert one notification row per eligible recipient who has the type switched on. */
export async function fanOut(
  payload: NotifyPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any,
): Promise<{ sent: number; reason?: string }> {
  try {
    let sb = client;
    if (!sb) {
      const isPublicAdminAlert =
        payload.type === "admin_new_member" || payload.type === "admin_new_sponsor";
      if (!isPublicAdminAlert) {
        const reason = "authenticated notification client required";
        console.error("[notify] fan-out blocked", payload.type, reason);
        return { sent: 0, reason };
      }
      const { createPublicSupabase } = await import("./public-supabase.server");
      sb = createPublicSupabase();
    }

    const { data, error } = await sb.rpc("fanout_notification", {
      _type: payload.type,
      _title_en: payload.title_en,
      _title_af: payload.title_af,
      _body_en: payload.body_en ?? null,
      _body_af: payload.body_af ?? null,
      _link: payload.link ?? null,
      _related_id: payload.related_id ?? null,
      _exclude: payload.excludeUserId ?? null,
    });
    if (error) throw error;

    const sent = Number(data ?? 0);
    console.log("[notify] sent", payload.type, "to", sent, "recipient(s)");
    return sent > 0 ? { sent } : { sent: 0, reason: "no eligible recipients" };
  } catch (e) {
    console.error("[notify] fan-out failed", payload.type, e);
    return { sent: 0, reason: e instanceof Error ? e.message : String(e) };
  }
}
