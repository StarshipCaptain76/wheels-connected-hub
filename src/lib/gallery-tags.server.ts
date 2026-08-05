/** Server-only helper for best-effort gallery tag notifications. */

/** Direct notification to one member, respecting their photo_tag preference. */
export async function notifyTagged(
  input: {
    userId: string;
    taggerName: string;
    link: string;
    relatedId: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any,
): Promise<void> {
  try {
    const { elevated } = await import("./elevated.server");
    const sb = await elevated(client);
    const { error } = await sb.rpc("notify_user", {
      _user_id: input.userId,
      _type: "photo_tag",
      _title_en: "You were tagged in a photo",
      _title_af: "Jy is in 'n foto gemerk",
      _body_en: input.taggerName + " tagged you in a club photo.",
      _body_af: input.taggerName + " het jou in 'n klubfoto gemerk.",
      _link: input.link,
      _related_id: input.relatedId,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[gallery-tags] notify failed", e);
  }
}
