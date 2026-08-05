import { createServerFn } from "@tanstack/react-start";

export type FeaturedMember = {
  display_name: string | null;
  member_number: number;
  town: string | null;
  favourite_ride: string | null;
  featured_bio: string | null;
  featured_photo_url: string | null;
  avatar_url: string | null;
  featured_since: string | null;
  /** One random garage vehicle photo URL for the homepage card */
  garage_thumb_url: string | null;
};

export const getCurrentFeaturedMember = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedMember | null> => {
    // Featured data is public, but the rotation helper is privileged, so this
    // read runs server-side with an explicit, narrow column projection.
    // NEVER throw — a missing service role key must not take the home page down.
    try {
    const { elevated, hasServiceRole } = await import("./elevated.server");
    const supabaseAdmin = await elevated();

    // Public-safe card: a SECURITY DEFINER view of today's featured member,
    // so the home page still works without a service-role key.
    const { data: card, error: cardErr } = await supabaseAdmin
      .rpc("featured_member_card")
      .maybeSingle();
    if (cardErr || !card) return null;
    const data = card as {
      id: string;
      display_name: string | null;
      member_number: number | null;
      town: string | null;
      favourite_ride: string | null;
      featured_bio: string | null;
      featured_photo_url: string | null;
      avatar_url: string | null;
      featured_since: string | null;
    };
    const canSign = hasServiceRole();

    let garage_thumb_url: string | null = null;
    try {
      if (!canSign) throw new Error("no signing key");
      const { data: vehicles } = await supabaseAdmin
        .from("garage_vehicles")
        .select("id")
        .eq("user_id", data.id as string);
      const vehicleIds = (vehicles ?? []).map((v: { id: string }) => v.id);
      if (vehicleIds.length > 0) {
        const { data: photos } = await supabaseAdmin
          .from("garage_vehicle_photos")
          .select("storage_path")
          .in("vehicle_id", vehicleIds);
        const paths = (photos ?? [])
          .map((p: { storage_path: string }) => p.storage_path)
          .filter(Boolean);
        if (paths.length > 0) {
          // Deterministic per-day pick so SSR and client render the same image
          const day = Math.floor(Date.now() / 86_400_000);
          const pick = paths.sort()[day % paths.length];

          const { data: signed } = await supabaseAdmin.storage
            .from("garage")
            .createSignedUrl(pick, 60 * 60 * 24 * 7);
          garage_thumb_url = signed?.signedUrl ?? null;
        }
      }
    } catch {
      garage_thumb_url = null;
    }

    const { signStoredUrl } = await import("./storage-urls.server");

    return {
      display_name: data.display_name,
      member_number: data.member_number ?? 0,
      town: data.town,
      favourite_ride: data.favourite_ride,
      featured_bio: data.featured_bio,
      featured_photo_url: canSign
        ? await signStoredUrl(supabaseAdmin, data.featured_photo_url)
        : data.featured_photo_url,
      avatar_url: canSign ? await signStoredUrl(supabaseAdmin, data.avatar_url) : data.avatar_url,
      featured_since: data.featured_since,
      garage_thumb_url,
    };
    } catch (e) {
      console.error("[featured-member] failed (site continues)", e);
      return null;
    }
  },

);

