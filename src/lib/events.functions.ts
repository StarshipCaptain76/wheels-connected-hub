import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { notifyNewEvent } from "./events-notify.server";
import { eventImageUrl, isPrivateStorageUrl } from "./event-image-url";

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
  /** Always-loadable URL for display (raw cover_url stays intact for saving). */
  cover_display_url?: string | null;
  hero_image_url?: string | null;
  details_md?: string | null;
  details_af_md?: string | null;
  destination_address?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  destination_place_id?: string | null;
  is_published?: boolean;
};

const ADMIN_EVENT_COLS =
  "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url, hero_image_url, details_md, details_af_md, destination_address, destination_lat, destination_lng, destination_place_id, is_published";

function asCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function withAdminFields<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    destination_lat: asCoord(row.destination_lat),
    destination_lng: asCoord(row.destination_lng),
  };
}

/**
 * Event covers live in the private `gallery` bucket. Instead of signing
 * (which expires and needs the service key) we point the browser at a stable
 * server endpoint that streams the bytes: /api/public/event-image.
 */
function withDisplayUrls<T extends { id: string; cover_url: string | null }>(rows: T[]): T[] {
  return rows.map((r) => ({
    ...r,
    cover_display_url:
      r.cover_url && isPrivateStorageUrl(r.cover_url) ? eventImageUrl(r.id, "cover") : r.cover_url,
  }));
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
    return withDisplayUrls((data ?? []) as PublicEvent[]);
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
    return withDisplayUrls((data ?? []) as PublicEvent[]);
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
    return row ? withDisplayUrls([row])[0] : null;
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
      .select(ADMIN_EVENT_COLS)
      .order("starts_at", { ascending: false });
    if (error) throw error;
    // Include every field the editor can save. Omitting destination/hero/details
    // made Edit→Save write nulls and wipe the map pin Concours Mini needs.
    return withDisplayUrls((data ?? []).map((r) => withAdminFields(r as Record<string, unknown>)) as PublicEvent[]);
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
  cover_url: z.string().trim().max(2000).nullable().optional(),
  hero_image_url: z.string().trim().max(2000).nullable().optional(),
  details_md: z.string().trim().max(6000).nullable().optional(),
  details_af_md: z.string().trim().max(6000).nullable().optional(),
  destination_address: z.string().trim().max(300).nullable().optional(),
  destination_lat: z.preprocess(asCoord, z.number().nullable().optional()),
  destination_lng: z.preprocess(asCoord, z.number().nullable().optional()),
  destination_place_id: z.string().trim().max(200).nullable().optional(),
  is_published: z.boolean().default(true),
});

/** Strip expiring signed tokens; keep a stable public-format storage URL for DB. */
function stabilizeStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /^(https?:\/\/[^/]+\/storage\/v1\/object\/)(?:sign|authenticated)\/([^?]+)/,
  );
  if (m) {
    // Convert signed → public form (still private bucket; re-signed on read)
    return `${m[1]}public/${m[2]}`;
  }
  return url;
}

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...rest } = data;
    const values: Record<string, unknown> = {
      ...rest,
      cover_url: stabilizeStorageUrl(rest.cover_url),
      hero_image_url: stabilizeStorageUrl(rest.hero_image_url),
    };
    if (id) {
      const { data: prev } = await supabase
        .from("events")
        .select(
          "is_published, destination_lat, destination_lng, destination_address, destination_place_id, hero_image_url, details_md, details_af_md",
        )
        .eq("id", id)
        .maybeSingle();
      // Form used to omit destination fields; never wipe a saved pin unless the
      // admin actually submitted new coordinates.
      if (values.destination_lat == null || values.destination_lng == null) {
        if (prev && asCoord(prev.destination_lat) != null && asCoord(prev.destination_lng) != null) {
          values.destination_lat = asCoord(prev.destination_lat);
          values.destination_lng = asCoord(prev.destination_lng);
          if (!values.destination_address) {
            values.destination_address = prev.destination_address ?? null;
          }
          if (!values.destination_place_id) {
            values.destination_place_id = prev.destination_place_id ?? null;
          }
        }
      }
      if (values.hero_image_url == null && prev?.hero_image_url) {
        values.hero_image_url = prev.hero_image_url;
      }
      if (values.details_md == null && prev?.details_md) {
        values.details_md = prev.details_md;
      }
      if (values.details_af_md == null && prev?.details_af_md) {
        values.details_af_md = prev.details_af_md;
      }
      const { data: updated, error } = await supabase
        .from("events")
        .update(values as never)
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
        await notifyNewEvent(id, rest.title, rest.title_af ?? null, supabase);
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
      await notifyNewEvent(row.id as string, rest.title, rest.title_af ?? null, supabase);
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
