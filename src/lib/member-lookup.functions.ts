import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MemberGarage = {
  user_id: string;
  display_name: string | null;
  member_number: number;
  town: string | null;
  favourite_ride: string | null;
  avatar_url: string | null;
  joined_at: string;
  is_featured: boolean;
  featured_bio: string | null;
  featured_photo_url: string | null;
  directory_visible: boolean;
  upcoming: Array<{ event_id: string; title: string; starts_at: string; status: string }>;
};

export const getMemberByNumber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ number: z.number().int().min(1).max(1_000_000) }).parse(i),
  )
  .handler(async ({ context, data }): Promise<MemberGarage | null> => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("profiles")
      .select(
        "id, display_name, member_number, town, favourite_ride, avatar_url, joined_at, is_featured, featured_bio, featured_photo_url, directory_visible, membership_status",
      )
      .eq("member_number", data.number)
      .maybeSingle();
    if (!p) return null;

    const isSelf = p.id === userId;
    const visible =
      p.directory_visible !== false && p.membership_status !== "suspended";
    // Hidden members are only visible to themselves (admins use the admin portal)
    if (!isSelf && !visible) return null;

    const { data: rsvps, error: rsvpErr } = await supabase.rpc("member_upcoming_events", {
      _user_id: p.id,
    });
    if (rsvpErr) throw new Error(rsvpErr.message);

    const upcoming = ((rsvps ?? []) as MemberGarage["upcoming"]).slice().sort((a, b) =>
      a.starts_at.localeCompare(b.starts_at),
    );

    const { signStoredUrl } = await import("./storage-urls.server");
    const avatarSigned = await signStoredUrl(supabase, p.avatar_url as string | null);

    return {
      user_id: p.id,
      display_name: p.display_name,
      member_number: p.member_number,
      town: p.town,
      favourite_ride: p.favourite_ride,
      avatar_url: avatarSigned,
      joined_at: p.joined_at,
      is_featured: Boolean(p.is_featured),
      featured_bio: p.featured_bio,
      featured_photo_url: p.featured_photo_url,
      directory_visible: p.directory_visible !== false,
      upcoming,
    };
  });
