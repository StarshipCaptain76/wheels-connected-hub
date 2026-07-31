import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type DirectoryMember = {
  user_id: string;
  display_name: string | null;
  member_number: number;
  town: string | null;
  favourite_ride: string | null;
  avatar_url: string | null;
  joined_at: string;
  membership_status: string;
  is_featured: boolean;
  primary_vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    nickname: string | null;
  } | null;
  /** Primary (or first) car photo URL for membership-card background */
  car_photo_url: string | null;
  /** Oldest vehicle year across garage (for age sort); null if no years */
  oldest_year: number | null;
  /** Newest vehicle year across garage */
  newest_year: number | null;
};

export type DirectorySort =
  | "name"
  | "number"
  | "joined_desc"
  | "joined_asc"
  | "vehicle_oldest"
  | "vehicle_newest"
  | "town";

const listSchema = z.object({
  search: z.string().trim().max(80).optional().default(""),
  sort: z
    .enum(["name", "number", "joined_desc", "joined_asc", "vehicle_oldest", "vehicle_newest", "town"])
    .optional()
    .default("name"),
  town: z.string().trim().max(80).optional().default(""),
  featuredOnly: z.boolean().optional().default(false),
});

function vehicleLabel(v: {
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}): string {
  const parts = [v.year, v.make, v.model].filter(Boolean).join(" ");
  if (v.nickname && parts) return `${v.nickname} (${parts})`;
  return v.nickname || parts || "";
}

/** Admin accounts stay out of the public club directory. */
async function loadAdminUserIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) {
      console.error("[directory] admin role lookup failed", error);
      return ids;
    }
    for (const row of data ?? []) {
      if (row.user_id) ids.add(String(row.user_id));
    }
  } catch (e) {
    console.error("[directory] admin role lookup skipped", e);
  }
  return ids;
}

async function resolveGarageUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  for (const path of unique) {
    try {
      const { data: pub } = supabase.storage.from("garage").getPublicUrl(path);
      if (pub?.publicUrl) map.set(path, pub.publicUrl);
    } catch {
      /* ignore */
    }
  }
  const missing = unique.filter((p) => !map.get(p));
  if (missing.length > 0) {
    try {
      const { data } = await supabase.storage
        .from("garage")
        .createSignedUrls(missing, 60 * 60 * 24 * 7);
      for (const row of data ?? []) {
        if (row?.path && row?.signedUrl) map.set(row.path, row.signedUrl);
      }
    } catch (e) {
      console.error("[directory] garage sign failed", e);
    }
  }
  return map;
}

export const listDirectoryMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listSchema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<DirectoryMember[]> => {
    const { supabase } = context;

    const adminIds = await loadAdminUserIds();

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, member_number, town, favourite_ride, avatar_url, joined_at, is_featured, directory_visible, membership_status",
      )
      .eq("directory_visible", true)
      .neq("membership_status", "suspended")
      .order("member_number", { ascending: true });

    if (error) throw error;
    if (!profiles?.length) return [];

    const visibleProfiles = profiles.filter((p) => !adminIds.has(String(p.id)));
    if (!visibleProfiles.length) return [];

    const ids = visibleProfiles.map((p) => p.id);
    const { data: vehicles, error: vErr } = await supabase
      .from("garage_vehicles")
      .select("id, user_id, year, make, model, nickname, is_primary, sort")
      .in("user_id", ids)
      .order("sort", { ascending: true });

    if (vErr) throw vErr;

    type VRow = {
      id: string;
      user_id: string;
      year: number | null;
      make: string | null;
      model: string | null;
      nickname: string | null;
      is_primary: boolean;
      sort: number;
    };

    const byUser = new Map<string, VRow[]>();
    for (const v of (vehicles ?? []) as VRow[]) {
      const list = byUser.get(v.user_id) ?? [];
      list.push({
        id: v.id,
        user_id: v.user_id,
        year: v.year,
        make: v.make,
        model: v.model,
        nickname: v.nickname,
        is_primary: Boolean(v.is_primary),
        sort: v.sort ?? 0,
      });
      byUser.set(v.user_id, list);
    }

    // Primary (or first) vehicle id per user → first photo
    const vehicleIdByUser = new Map<string, string>();
    for (const [userId, garage] of byUser) {
      const primary = garage.find((g) => g.is_primary) ?? garage[0];
      if (primary) vehicleIdByUser.set(userId, primary.id);
    }

    const vehicleIds = [...vehicleIdByUser.values()];
    const photoPathByVehicle = new Map<string, string>();
    if (vehicleIds.length > 0) {
      const { data: photos } = await supabase
        .from("garage_vehicle_photos")
        .select("vehicle_id, storage_path, sort")
        .in("vehicle_id", vehicleIds)
        .order("sort", { ascending: true })
        .order("created_at", { ascending: true });

      for (const p of photos ?? []) {
        if (!photoPathByVehicle.has(p.vehicle_id) && p.storage_path) {
          photoPathByVehicle.set(p.vehicle_id, p.storage_path);
        }
      }
    }

    const urlMap = await resolveGarageUrls(supabase, [...photoPathByVehicle.values()]);

    let rows: DirectoryMember[] = visibleProfiles.map((p) => {
      const garage = byUser.get(p.id) ?? [];
      const primary = garage.find((g) => g.is_primary) ?? garage[0] ?? null;
      const years = garage.map((g) => g.year).filter((y): y is number => y != null);
      const oldest_year = years.length ? Math.min(...years) : null;
      const newest_year = years.length ? Math.max(...years) : null;

      let car_photo_url: string | null = null;
      const vid = vehicleIdByUser.get(p.id);
      if (vid) {
        const path = photoPathByVehicle.get(vid);
        if (path) car_photo_url = urlMap.get(path) ?? null;
      }

      return {
        user_id: p.id,
        display_name: p.display_name,
        member_number: p.member_number,
        town: p.town,
        favourite_ride: p.favourite_ride,
        avatar_url: p.avatar_url,
        joined_at: p.joined_at,
        membership_status: String(p.membership_status ?? "active"),
        is_featured: Boolean(p.is_featured),
        primary_vehicle: primary
          ? {
              year: primary.year,
              make: primary.make,
              model: primary.model,
              nickname: primary.nickname,
            }
          : null,
        car_photo_url,
        oldest_year,
        newest_year,
      };
    });

    const q = (data.search ?? "").toLowerCase().trim();
    if (q) {
      rows = rows.filter((m) => {
        const hay = [
          m.display_name,
          m.town,
          m.favourite_ride,
          String(m.member_number),
          m.primary_vehicle ? vehicleLabel(m.primary_vehicle) : "",
          m.primary_vehicle?.make,
          m.primary_vehicle?.model,
          m.primary_vehicle?.nickname,
          m.primary_vehicle?.year != null ? String(m.primary_vehicle.year) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const townFilter = (data.town ?? "").trim().toLowerCase();
    if (townFilter) {
      rows = rows.filter((m) => (m.town ?? "").toLowerCase() === townFilter);
    }

    if (data.featuredOnly) {
      rows = rows.filter((m) => m.is_featured);
    }

    const sort = data.sort ?? "name";
    rows.sort((a, b) => {
      switch (sort) {
        case "number":
          return a.member_number - b.member_number;
        case "joined_desc":
          return b.joined_at.localeCompare(a.joined_at);
        case "joined_asc":
          return a.joined_at.localeCompare(b.joined_at);
        case "vehicle_oldest": {
          const ay = a.oldest_year ?? 9999;
          const by = b.oldest_year ?? 9999;
          if (ay !== by) return ay - by;
          return (a.display_name ?? "").localeCompare(b.display_name ?? "");
        }
        case "vehicle_newest": {
          const ay = a.newest_year ?? 0;
          const by = b.newest_year ?? 0;
          if (ay !== by) return by - ay;
          return (a.display_name ?? "").localeCompare(b.display_name ?? "");
        }
        case "town": {
          const t = (a.town ?? "zzz").localeCompare(b.town ?? "zzz");
          if (t !== 0) return t;
          return (a.display_name ?? "").localeCompare(b.display_name ?? "");
        }
        case "name":
        default:
          return (a.display_name ?? `Member #${a.member_number}`).localeCompare(
            b.display_name ?? `Member #${b.member_number}`,
          );
      }
    });

    return rows;
  });

export const listDirectoryTowns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase } = context;

    const adminIds = await loadAdminUserIds();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, town")
      .eq("directory_visible", true)
      .neq("membership_status", "suspended")
      .not("town", "is", null);
    if (error) throw error;
    const set = new Set<string>();
    for (const row of data ?? []) {
      if (adminIds.has(String(row.id))) continue;
      const t = (row.town ?? "").trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });
