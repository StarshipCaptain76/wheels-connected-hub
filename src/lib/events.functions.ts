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
      // Events that started earlier today stay in "upcoming" for the full day.
      .gte("starts_at", startOfTodaySastIso())
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
      .lt("starts_at", startOfTodaySastIso())
      .order("starts_at", { ascending: false })
      .limit(48);
    if (error) throw new Error(error.message);
    return withDisplayUrls((data ?? []) as PublicEvent[]);
  },
);

/** Midnight (Africa/Johannesburg, UTC+2) at the start of today, as an ISO instant. */
function startOfTodaySastIso(): string {
  const nowSast = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const midnightSast = Date.UTC(
    nowSast.getUTCFullYear(),
    nowSast.getUTCMonth(),
    nowSast.getUTCDate(),
  );
  return new Date(midnightSast - 2 * 60 * 60 * 1000).toISOString();
}

export const getNextEvent = createServerFn({ method: "GET" }).handler(
  async (): Promise<(PublicEvent & { going_count?: number; going_party_total?: number }) | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    // Keep an event that started earlier today on the home banner all day.
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url",
      )
      .eq("is_published", true)
      .gte("starts_at", startOfTodaySastIso())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data as PublicEvent | null) ?? null;
    if (!row) return null;
    const withUrls = withDisplayUrls([row])[0];
    let going_count = 0;
    let going_party_total = 0;
    try {
      const { data: c } = await supabase.rpc("event_rsvp_totals", { _event_id: row.id });
      const t = Array.isArray(c) ? c[0] : c;
      if (t) {
        going_count = Number(t.going ?? 0);
        going_party_total = Number(t.going_party_total ?? 0);
      }
    } catch (e) {
      console.warn("[getNextEvent] counts skipped", e);
    }
    return { ...withUrls, going_count, going_party_total };
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
    const emptyToNull = (v: unknown) =>
      typeof v === "string" && v.trim() === "" ? null : (v ?? null);
    const values: Record<string, unknown> = {
      ...rest,
      title_af: emptyToNull(rest.title_af),
      description: emptyToNull(rest.description),
      description_af: emptyToNull(rest.description_af),
      location: emptyToNull(rest.location),
      details_md: emptyToNull(rest.details_md),
      details_af_md: emptyToNull(rest.details_af_md),
      destination_address: emptyToNull(rest.destination_address),
      destination_place_id: emptyToNull(rest.destination_place_id),
      cover_url: stabilizeStorageUrl(rest.cover_url),
      hero_image_url: stabilizeStorageUrl(rest.hero_image_url),
    };
    if (id) {
      // The admin form submits every field, so whatever it sends is the new
      // truth — including cleared images, details and map pins.
      const { data: prev } = await supabase
        .from("events")
        .select("is_published")
        .eq("id", id)
        .maybeSingle();

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
      .insert(values as never)
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
