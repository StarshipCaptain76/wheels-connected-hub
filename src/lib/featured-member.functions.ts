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
};

export const getCurrentFeaturedMember = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedMember | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "display_name, member_number, town, favourite_ride, featured_bio, featured_photo_url, avatar_url, featured_since",
      )
      .eq("is_featured", true)
      .maybeSingle();
    if (error) return null;
    return (data as FeaturedMember | null) ?? null;
  },
);
