import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EventWaypoint = {
  id: string;
  event_id: string;
  label: string;
  label_af: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  meet_time: string | null;
  sort: number;
};

export type EventDetail = {
  id: string;
  title: string;
  title_af: string | null;
  description: string | null;
  description_af: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  hero_image_url: string | null;
  details_md: string | null;
  details_af_md: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_place_id: string | null;
  destination_address: string | null;
  is_published: boolean;
  waypoints: EventWaypoint[];
  counts: { going: number; going_party_total: number; maybe: number; not_going: number };
};

const CORE_COLS =
  "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url, is_published";

const EXTENDED_COLS =
  "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url, hero_image_url, details_md, details_af_md, destination_lat, destination_lng, destination_place_id, destination_address, is_published";

function isPrivateStorageUrl(url: string): boolean {
  return /\/object\/(?:public|sign|authenticated)\/(gallery|garage|listings|sponsors)\//.test(url);
}

export const getEventDetail = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<EventDetail | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();

    let event: Record<string, unknown> | null = null;

    const full = await supabase
      .from("events")
      .select(EXTENDED_COLS)
      .eq("id", data.id)
      .eq("is_published", true)
      .maybeSingle();

    if (full.error) {
      console.warn("[getEventDetail] extended select failed, trying core", full.error.message);
      const core = await supabase
        .from("events")
        .select(CORE_COLS)
        .eq("id", data.id)
        .eq("is_published", true)
        .maybeSingle();
      if (core.error) {
        console.error("[getEventDetail] core select failed", core.error);
        throw new Error(core.error.message);
      }
      event = core.data as Record<string, unknown> | null;
    } else {
      event = full.data as Record<string, unknown> | null;
    }

    if (!event) return null;

    let waypoints: EventWaypoint[] = [];
    try {
      const { data: wp, error: wpErr } = await supabase
        .from("event_waypoints")
        .select("id, event_id, label, label_af, address, lat, lng, place_id, meet_time, sort")
        .eq("event_id", data.id)
        .order("sort", { ascending: true });
      if (!wpErr && wp) waypoints = wp as EventWaypoint[];
    } catch (e) {
      console.warn("[getEventDetail] waypoints skipped", e);
    }

    let counts = { going: 0, going_party_total: 0, maybe: 0, not_going: 0 };
    try {
      const { data: c } = await supabase
        .from("event_rsvp_counts")
        .select("going_count, going_party_total, maybe_count, not_going_count")
        .eq("event_id", data.id)
        .maybeSingle();
      if (c) {
        counts = {
          going: Number(c.going_count ?? 0),
          going_party_total: Number(c.going_party_total ?? 0),
          maybe: Number(c.maybe_count ?? 0),
          not_going: Number(c.not_going_count ?? 0),
        };
      }
    } catch (e) {
      console.warn("[getEventDetail] counts skipped", e);
    }

    // Soft-fail image signing — never take the page down if SERVICE_ROLE_KEY is missing
    let signed = new Map<string, string>();
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { signStoredUrls } = await import("./storage-urls.server");
        signed = await signStoredUrls(supabaseAdmin, [
          event.cover_url as string | null,
          event.hero_image_url as string | null,
        ]);
      } else {
        console.warn("[getEventDetail] SERVICE_ROLE_KEY missing — covers may not display");
      }
    } catch (e) {
      console.error("[getEventDetail] sign failed (continuing)", e);
    }

    const sign = (u: string | null) => {
      if (!u) return null;
      const s = signed.get(u);
      if (s) return s;
      return isPrivateStorageUrl(u) ? null : u;
    };

    return {
      id: event.id as string,
      title: event.title as string,
      title_af: (event.title_af as string | null) ?? null,
      description: (event.description as string | null) ?? null,
      description_af: (event.description_af as string | null) ?? null,
      location: (event.location as string | null) ?? null,
      starts_at: event.starts_at as string,
      ends_at: (event.ends_at as string | null) ?? null,
      cover_url: sign((event.cover_url as string | null) ?? null),
      hero_image_url: sign((event.hero_image_url as string | null) ?? null),
      details_md: (event.details_md as string | null) ?? null,
      details_af_md: (event.details_af_md as string | null) ?? null,
      destination_lat: (event.destination_lat as number | null) ?? null,
      destination_lng: (event.destination_lng as number | null) ?? null,
      destination_place_id: (event.destination_place_id as string | null) ?? null,
      destination_address: (event.destination_address as string | null) ?? null,
      is_published: Boolean(event.is_published),
      waypoints,
      counts,
    };
  });

export type AttendeeRow = {
  user_id: string;
  status: "going" | "maybe" | "not_going";
  party_size: number;
  note: string | null;
  display_name: string | null;
  member_number: number;
  town: string | null;
  avatar_url: string | null;
  favourite_ride: string | null;
};

export const listEventAttendees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<AttendeeRow[]> => {
    const { supabase } = context;
    const { data: rsvps, error } = await supabase
      .from("event_rsvps")
      .select("user_id, status, party_size, note")
      .eq("event_id", data.id)
      .in("status", ["going", "maybe"]);
    if (error) throw error;
    if (!rsvps?.length) return [];

    const ids = rsvps.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, member_number, town, avatar_url, favourite_ride")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return rsvps
      .map((r) => {
        const p = byId.get(r.user_id);
        if (!p) return null;
        return {
          user_id: r.user_id,
          status: r.status as AttendeeRow["status"],
          party_size: r.party_size,
          note: r.note,
          display_name: p.display_name,
          member_number: p.member_number,
          town: p.town,
          avatar_url: p.avatar_url,
          favourite_ride: p.favourite_ride,
        } satisfies AttendeeRow;
      })
      .filter((r): r is AttendeeRow => Boolean(r))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "going" ? -1 : 1;
        return (a.display_name ?? "").localeCompare(b.display_name ?? "");
      });
  });

export const getMyRsvp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("event_rsvps")
      .select("status, party_size, note")
      .eq("event_id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    return row ?? null;
  });

const rsvpInput = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["going", "maybe", "not_going"]),
  partySize: z.number().int().min(1).max(10).default(1),
  note: z.string().trim().max(280).nullable().optional(),
});

export const upsertMyRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rsvpInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_rsvps").upsert(
      {
        event_id: data.eventId,
        user_id: userId,
        status: data.status,
        party_size: data.status === "going" ? data.partySize : 1,
        note: data.note ?? null,
      },
      { onConflict: "event_id,user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const deleteMyRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", data.eventId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

const waypointInput = z.object({
  id: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1).max(120),
  label_af: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  place_id: z.string().trim().max(200).nullable().optional(),
  meet_time: z.string().nullable().optional(),
  sort: z.number().int().min(0).max(999).default(0),
});

export const saveEventWaypoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        waypoints: z.array(waypointInput).max(15),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { error: delErr } = await supabase
      .from("event_waypoints")
      .delete()
      .eq("event_id", data.eventId);
    if (delErr) throw delErr;

    if (data.waypoints.length === 0) return { ok: true };

    const rows = data.waypoints.map((w, i) => ({
      event_id: data.eventId,
      label: w.label,
      label_af: w.label_af ?? null,
      address: w.address ?? null,
      lat: w.lat ?? null,
      lng: w.lng ?? null,
      place_id: w.place_id ?? null,
      meet_time: w.meet_time ?? null,
      sort: w.sort ?? i,
    }));
    const { error: insErr } = await supabase.from("event_waypoints").insert(rows);
    if (insErr) throw insErr;
    return { ok: true };
  });

export const listEventWaypointsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<EventWaypoint[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: rows } = await supabase
      .from("event_waypoints")
      .select("id, event_id, label, label_af, address, lat, lng, place_id, meet_time, sort")
      .eq("event_id", data.eventId)
      .order("sort", { ascending: true });
    return (rows ?? []) as EventWaypoint[];
  });
