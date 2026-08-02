/** Server-only helper for best-effort gallery tag notifications. */

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

