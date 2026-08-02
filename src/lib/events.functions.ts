import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { notifyNewEvent } from "./events-notify.server";

export type PublicEvent = {
  id: string;
  title: string;
  title_af: string | null;
  description: string | null;
  description_af: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  is_published?: boolean;
};

/** Event covers live in the private `gallery` bucket — re-sign for display. */
async function signCovers<T extends { cover_url: string | null }>(rows: T[]): Promise<T[]> {
  const urls = rows.map((r) => r.cover_url).filter(Boolean) as string[];
  if (urls.length === 0) return rows;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signStoredUrls } = await import("./storage-urls.server");
  const map = await signStoredUrls(supabaseAdmin, urls);
  return rows.map((r) => (r.cover_url ? { ...r, cover_url: map.get(r.cover_url) ?? r.cover_url } : r));
}



export const listUpcomingEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEvent[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url",
      )
      .eq("is_published", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(24);
    if (error) throw new Error(error.message);
    return signCovers((data ?? []) as PublicEvent[]);
  },
);

/** Published events that have already started (in progress or finished). */
export const listPastEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEvent[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url",
      )
      .eq("is_published", true)
      .lt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(48);
    if (error) throw new Error(error.message);
    return signCovers((data ?? []) as PublicEvent[]);
  },
);

export const getNextEvent = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEvent | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url",
      )
      .eq("is_published", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data as PublicEvent | null) ?? null;
    return row ? (await signCovers([row]))[0] : null;
  },
);

export const listAllEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicEvent[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url, is_published",
      )
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return signCovers((data ?? []) as PublicEvent[]);
  });

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  title_af: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  description_af: z.string().trim().max(2000).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().nullable().optional(),
  cover_url: z.string().trim().max(1000).nullable().optional(),
  hero_image_url: z.string().trim().max(1000).nullable().optional(),
  details_md: z.string().trim().max(6000).nullable().optional(),
  details_af_md: z.string().trim().max(6000).nullable().optional(),
  destination_address: z.string().trim().max(300).nullable().optional(),
  destination_lat: z.number().nullable().optional(),
  destination_lng: z.number().nullable().optional(),
  destination_place_id: z.string().trim().max(200).nullable().optional(),
  is_published: z.boolean().default(true),
});

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...values } = data;
    if (id) {
      const { data: prev } = await supabase
        .from("events")
        .select("is_published")
        .eq("id", id)
        .maybeSingle();
      const { data: updated, error } = await supabase
        .from("events")
        .update(values)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        throw new Error(
          "Update blocked by database permissions. Run the events admin RLS policies in Supabase SQL editor.",
        );
      }
      if (values.is_published && prev && prev.is_published === false) {
        await notifyNewEvent(id, values.title, values.title_af ?? null);
      }
      return { id };
    }
    const { data: row, error } = await supabase
      .from("events")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    if (values.is_published) {
      await notifyNewEvent(row.id as string, values.title, values.title_af ?? null);
    }
    return { id: row.id };
  });



export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    await supabase.from("event_rsvps").delete().eq("event_id", data.id);
    await supabase.from("event_waypoints").delete().eq("event_id", data.id);
    await supabase.from("event_photos").delete().eq("event_id", data.id);

    const { data: deleted, error } = await supabase
      .from("events")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!deleted) {
      throw new Error(
        "Delete blocked by database permissions. Run the events admin RLS policies in Supabase SQL editor.",
      );
    }
    return { ok: true };
  });
