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
    if (!isSelf && !visible) {
      // Check admin
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) return null;
    }

    const nowIso = new Date().toISOString();
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("event_id, status, events!inner(id, title, starts_at, is_published)")
      .eq("user_id", p.id)
      .in("status", ["going", "maybe"])
      .gte("events.starts_at", nowIso)
      .eq("events.is_published", true);

    const upcoming =
      (rsvps ?? [])
        .map((r) => {
          const ev = r.events as unknown as { id: string; title: string; starts_at: string } | null;
          if (!ev) return null;
          return {
            event_id: ev.id,
            title: ev.title,
            starts_at: ev.starts_at,
            status: r.status,
          };
        })
        .filter(Boolean) as MemberGarage["upcoming"];

    return {
      user_id: p.id,
      display_name: p.display_name,
      member_number: p.member_number,
      town: p.town,
      favourite_ride: p.favourite_ride,
      avatar_url: p.avatar_url,
      joined_at: p.joined_at,
      is_featured: Boolean(p.is_featured),
      featured_bio: p.featured_bio,
      featured_photo_url: p.featured_photo_url,
      directory_visible: p.directory_visible !== false,
      upcoming: upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    };
  });
