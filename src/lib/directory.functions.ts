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
  is_featured: boolean;
  primary_vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    nickname: string | null;
  } | null;
  /** Oldest vehicle year across garage (for age sort); null if no years */
  oldest_year: number | null;
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

export const listDirectoryMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listSchema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<DirectoryMember[]> => {
    const { supabase } = context;

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

    const ids = profiles.map((p) => p.id);
    const { data: vehicles, error: vErr } = await supabase
      .from("garage_vehicles")
      .select("user_id, year, make, model, nickname, is_primary, sort")
      .in("user_id", ids)
      .order("sort", { ascending: true });

    if (vErr) throw vErr;

    const byUser = new Map<
      string,
      Array<{
        year: number | null;
        make: string | null;
        model: string | null;
        nickname: string | null;
        is_primary: boolean;
        sort: number;
      }>
    >();
    for (const v of vehicles ?? []) {
      const list = byUser.get(v.user_id) ?? [];
      list.push({
        year: v.year,
        make: v.make,
        model: v.model,
        nickname: v.nickname,
        is_primary: Boolean(v.is_primary),
        sort: v.sort ?? 0,
      });
      byUser.set(v.user_id, list);
    }

    let rows: DirectoryMember[] = profiles.map((p) => {
      const garage = byUser.get(p.id) ?? [];
      const primary =
        garage.find((g) => g.is_primary) ??
        garage[0] ??
        null;
      const years = garage.map((g) => g.year).filter((y): y is number => y != null);
      const oldest_year = years.length ? Math.min(...years) : null;

      return {
        user_id: p.id,
        display_name: p.display_name,
        member_number: p.member_number,
        town: p.town,
        favourite_ride: p.favourite_ride,
        avatar_url: p.avatar_url,
        joined_at: p.joined_at,
        is_featured: Boolean(p.is_featured),
        primary_vehicle: primary
          ? {
              year: primary.year,
              make: primary.make,
              model: primary.model,
              nickname: primary.nickname,
            }
          : null,
        oldest_year,
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
          const ay = a.oldest_year ?? 0;
          const by = b.oldest_year ?? 0;
          // Use newest year among vehicles when sorting newest-first
          const aYears = a.primary_vehicle?.year ?? a.oldest_year ?? 0;
          const bYears = b.primary_vehicle?.year ?? b.oldest_year ?? 0;
          if (aYears !== bYears) return bYears - aYears;
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
    const { data, error } = await supabase
      .from("profiles")
      .select("town")
      .eq("directory_visible", true)
      .neq("membership_status", "suspended")
      .not("town", "is", null);
    if (error) throw error;
    const set = new Set<
      string
    >();
    for (const row of data ?? []) {
      const t = (row.town ?? "").trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });
