/** Server-only helpers for gallery photo tagging. */

export type TagRow = {
  id: string;
  gallery_item_id: string;
  tagged_user_id: string;
  tagged_by: string;
  display_name: string | null;
  member_number: number | null;
  avatar_url: string | null;
};

type ProfileLite = {
  id: string;
  display_name: string | null;
  member_number: number | null;
  avatar_url: string | null;
};

export async function profilesByIds(ids: string[]): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  if (ids.length === 0) return map;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, member_number, avatar_url")
    .in("id", ids);
  for (const p of data ?? []) map.set(p.id as string, p as ProfileLite);
  return map;
}

export async function profileEmail(
  userId: string,
): Promise<{ name: string; email: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  return {
    name: (data?.display_name as string) || "A Just Wheels member",
    email: (data?.email as string) ?? null,
  };
}

/** Direct notification to one member, respecting their photo_tag preference. */
export async function notifyTagged(input: {
  userId: string;
  taggerName: string;
  link: string;
  relatedId: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pref } = await supabaseAdmin
      .from("notification_prefs")
      .select("photo_tag")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (pref && (pref as { photo_tag?: boolean }).photo_tag === false) return;

    await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      type: "photo_tag",
      title_en: "You were tagged in a photo",
      title_af: "Jy is in 'n foto gemerk",
      body_en: input.taggerName + " tagged you in a club photo.",
      body_af: input.taggerName + " het jou in 'n klubfoto gemerk.",
      link: input.link,
      related_id: input.relatedId,
    });
  } catch (e) {
    console.error("[gallery-tags] notify failed", e);
  }
}

/** How many invites this member has already sent today. */
export async function invitesSentToday(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("gallery_tag_invites")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", userId)
    .gte("created_at", since);
  return count ?? 0;
}

export async function inviteAlreadySent(
  galleryItemId: string,
  email: string,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("gallery_tag_invites")
    .select("id")
    .eq("gallery_item_id", galleryItemId)
    .eq("email", email)
    .maybeSingle();
  return Boolean(data);
}
