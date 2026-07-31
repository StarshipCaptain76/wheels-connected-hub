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
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("featured_member_public")
      .select(
        "id, display_name, member_number, town, favourite_ride, featured_bio, featured_photo_url, avatar_url, featured_since",
      )
      .maybeSingle();
    if (error || !data) return null;

    let garage_thumb_url: string | null = null;
    try {
      const { data: vehicles } = await supabase
        .from("garage_vehicles")
        .select("id")
        .eq("user_id", data.id);
      const vehicleIds = (vehicles ?? []).map((v: { id: string }) => v.id);
      if (vehicleIds.length > 0) {
        const { data: photos } = await supabase
          .from("garage_vehicle_photos")
          .select("storage_path")
          .in("vehicle_id", vehicleIds);
        const paths = (photos ?? [])
          .map((p: { storage_path: string }) => p.storage_path)
          .filter(Boolean);
        if (paths.length > 0) {
          const pick = paths[Math.floor(Math.random() * paths.length)];
          const { data: pub } = supabase.storage.from("garage").getPublicUrl(pick);
          if (pub?.publicUrl) {
            garage_thumb_url = pub.publicUrl;
          } else {
            const { data: signed } = await supabase.storage
              .from("garage")
              .createSignedUrl(pick, 60 * 60 * 24 * 7);
            garage_thumb_url = signed?.signedUrl ?? null;
          }
        }
      }
    } catch {
      garage_thumb_url = null;
    }

    return {
      display_name: data.display_name,
      member_number: data.member_number,
      town: data.town,
      favourite_ride: data.favourite_ride,
      featured_bio: data.featured_bio,
      featured_photo_url: data.featured_photo_url,
      avatar_url: data.avatar_url,
      featured_since: data.featured_since,
      garage_thumb_url,
    };
  },
);
