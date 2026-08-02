/**
 * Server-only fan-out helper for in-app notifications.
 * Never throws: notification failures must not block the primary action.
 */

export type NotificationType =
  | "new_listing"
  | "new_event"
  | "new_newsletter"
  | "admin_new_sponsor"
  | "admin_new_member"
  | "admin_listing_review";

const ADMIN_TYPES: NotificationType[] = [
  "admin_new_sponsor",
  "admin_new_member",
  "admin_listing_review",
];

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

async function recipientsFor(type: NotificationType): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (ADMIN_TYPES.includes(type)) {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw error;
    return [...new Set((data ?? []).map((r) => r.user_id as string))];
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("membership_status", "active");
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/** Insert one notification row per eligible recipient who has the type switched on. */
export async function fanOut(payload: NotifyPayload): Promise<{ sent: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ids = await recipientsFor(payload.type);
    if (payload.excludeUserId) ids = ids.filter((id) => id !== payload.excludeUserId);
    if (ids.length === 0) return { sent: 0 };

    // Respect opt-outs. Missing pref row = all types on (defaults).
    const { data: prefs } = await supabaseAdmin
      .from("notification_prefs")
      .select(`user_id, ${payload.type}`)
      .in("user_id", ids);
    const off = new Set(
      (prefs ?? [])
        .filter((p) => (p as Record<string, unknown>)[payload.type] === false)
        .map((p) => (p as { user_id: string }).user_id),
    );
    const targets = ids.filter((id) => !off.has(id));
    if (targets.length === 0) return { sent: 0 };

    const rows = targets.map((user_id) => ({
      user_id,
      type: payload.type,
      title_en: payload.title_en,
      title_af: payload.title_af,
      body_en: payload.body_en ?? null,
      body_af: payload.body_af ?? null,
      link: payload.link ?? null,
      related_id: payload.related_id ?? null,
    }));

    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) throw error;
    return { sent: rows.length };
  } catch (e) {
    console.error("[notify] fan-out failed", e);
    return { sent: 0 };
  }
}
