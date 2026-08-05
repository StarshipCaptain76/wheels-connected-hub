import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type GaragePhoto = {
  id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  sort: number;
};

export type GarageVehicle = {
  id: string;
  user_id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  nickname: string | null;
  story: string | null;
  story_af: string | null;
  is_primary: boolean;
  sort: number;
  built_by: string | null;
  engine: string | null;
  power: string | null;
  torque: string | null;
  acceleration: string | null;
  quarter_mile: string | null;
  top_speed: string | null;
  fuel_economy: string | null;
  transmission: string | null;
  diff_ratio: string | null;
  suspension_front: string | null;
  suspension_rear: string | null;
  brakes_front: string | null;
  brakes_rear: string | null;
  wheels_tyres: string | null;
  car_size: string | null;
  car_weight: string | null;
  extra_notes: string | null;
  photos: GaragePhoto[];
};

/** Prefer public URL; fall back to a long-lived signed URL. */
async function resolveUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;
  const { signPaths } = await import("./storage-urls.server");
  const signed = await signPaths(supabase, "garage", unique);
  for (const [k, v] of signed) map.set(k, v);
  return map;
}

async function hydrateVehicles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vehicles: any[],
): Promise<GarageVehicle[]> {
  if (vehicles.length === 0) return [];
  const ids = vehicles.map((v) => v.id);
  const { data: photos, error: photoErr } = await supabase
    .from("garage_vehicle_photos")
    .select("id, vehicle_id, storage_path, caption, sort")
    .in("vehicle_id", ids)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  if (photoErr) {
    console.error("garage_vehicle_photos select failed", photoErr);
  }

  const paths = (photos ?? []).map((p: { storage_path: string }) => p.storage_path);
  const urls = await resolveUrls(supabase, paths);

  const byVehicle = new Map<string, GaragePhoto[]>();
  for (const p of photos ?? []) {
    const list = byVehicle.get(p.vehicle_id) ?? [];
    list.push({
      id: p.id,
      storage_path: p.storage_path,
      url: urls.get(p.storage_path) ?? "",
      caption: p.caption,
      sort: p.sort,
    });
    byVehicle.set(p.vehicle_id, list);
  }

  return vehicles.map((v) => ({
    id: v.id,
    user_id: v.user_id,
    make: v.make,
    model: v.model,
    year: v.year,
    nickname: v.nickname,
    story: v.story,
    story_af: v.story_af,
    is_primary: Boolean(v.is_primary),
    sort: v.sort,
    built_by: v.built_by ?? null,
    engine: v.engine ?? null,
    power: v.power ?? null,
    torque: v.torque ?? null,
    acceleration: v.acceleration ?? null,
    quarter_mile: v.quarter_mile ?? null,
    top_speed: v.top_speed ?? null,
    fuel_economy: v.fuel_economy ?? null,
    transmission: v.transmission ?? null,
    diff_ratio: v.diff_ratio ?? null,
    suspension_front: v.suspension_front ?? null,
    suspension_rear: v.suspension_rear ?? null,
    brakes_front: v.brakes_front ?? null,
    brakes_rear: v.brakes_rear ?? null,
    wheels_tyres: v.wheels_tyres ?? null,
    car_size: v.car_size ?? null,
    car_weight: v.car_weight ?? null,
    extra_notes: v.extra_notes ?? null,
    photos: byVehicle.get(v.id) ?? [],
  }));
}

export const listMyGarage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GarageVehicle[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("garage_vehicles")
      .select("id, user_id, make, model, year, nickname, story, story_af, is_primary, sort, built_by, engine, power, torque, acceleration, quarter_mile, top_speed, fuel_economy, transmission, diff_ratio, suspension_front, suspension_rear, brakes_front, brakes_rear, wheels_tyres, car_size, car_weight, extra_notes")
      .eq("user_id", userId)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return hydrateVehicles(supabase, data ?? []);
  });

export const listGarageForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<GarageVehicle[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("garage_vehicles")
      .select("id, user_id, make, model, year, nickname, story, story_af, is_primary, sort, built_by, engine, power, torque, acceleration, quarter_mile, top_speed, fuel_economy, transmission, diff_ratio, suspension_front, suspension_rear, brakes_front, brakes_rear, wheels_tyres, car_size, car_weight, extra_notes")
      .eq("user_id", data.userId)
      .order("sort", { ascending: true });
    if (error) throw error;
    return hydrateVehicles(supabase, rows ?? []);
  });

/** Public featured garage (no auth) — for homepage / featured block */
export const listFeaturedGarage = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    member: {
      display_name: string | null;
      member_number: number;
      town: string | null;
      avatar_url: string | null;
      featured_bio: string | null;
    };
    vehicles: GarageVehicle[];
  } | null> => {
    const { elevated, hasServiceRole } = await import("./elevated.server");
    if (!hasServiceRole()) return null; // photos live in a private bucket
    const supabaseAdmin = await elevated();
    const { data: featuredId } = await supabaseAdmin.rpc("daily_featured_id");
    if (!featuredId) return null;
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, member_number, town, avatar_url, featured_bio")
      .eq("id", featuredId as string)
      .maybeSingle();
    if (!p || !p.id) return null;
    const { data: rows } = await supabaseAdmin
      .from("garage_vehicles")
      .select("id, user_id, make, model, year, nickname, story, story_af, is_primary, sort, built_by, engine, power, torque, acceleration, quarter_mile, top_speed, fuel_economy, transmission, diff_ratio, suspension_front, suspension_rear, brakes_front, brakes_rear, wheels_tyres, car_size, car_weight, extra_notes")
      .eq("user_id", p.id as string)
      .order("sort", { ascending: true });
    const vehicles = await hydrateVehicles(supabaseAdmin, rows ?? []);
    const { signStoredUrl } = await import("./storage-urls.server");
    return {
      member: {
        display_name: p.display_name,
        member_number: p.member_number ?? 0,
        town: p.town,
        avatar_url: await signStoredUrl(supabaseAdmin, p.avatar_url),
        featured_bio: p.featured_bio,
      },
      vehicles,
    };
  },
);


const vehicleSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  make: z.string().trim().max(80).nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  year: z.number().int().min(1886).max(2100).nullable().optional(),
  nickname: z.string().trim().max(80).nullable().optional(),
  story: z.string().trim().max(4000).nullable().optional(),
  story_af: z.string().trim().max(4000).nullable().optional(),
  is_primary: z.boolean().optional(),
  sort: z.number().int().min(0).max(9999).optional(),
  built_by: z.string().trim().max(600).nullable().optional(),
  engine: z.string().trim().max(600).nullable().optional(),
  power: z.string().trim().max(600).nullable().optional(),
  torque: z.string().trim().max(600).nullable().optional(),
  acceleration: z.string().trim().max(600).nullable().optional(),
  quarter_mile: z.string().trim().max(600).nullable().optional(),
  top_speed: z.string().trim().max(600).nullable().optional(),
  fuel_economy: z.string().trim().max(600).nullable().optional(),
  transmission: z.string().trim().max(600).nullable().optional(),
  diff_ratio: z.string().trim().max(600).nullable().optional(),
  suspension_front: z.string().trim().max(600).nullable().optional(),
  suspension_rear: z.string().trim().max(600).nullable().optional(),
  brakes_front: z.string().trim().max(600).nullable().optional(),
  brakes_rear: z.string().trim().max(600).nullable().optional(),
  wheels_tyres: z.string().trim().max(600).nullable().optional(),
  car_size: z.string().trim().max(600).nullable().optional(),
  car_weight: z.string().trim().max(600).nullable().optional(),
  extra_notes: z.string().trim().max(600).nullable().optional(),
});

export const upsertGarageVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => vehicleSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...values } = data;

    if (values.is_primary) {
      await supabase
        .from("garage_vehicles")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("is_primary", true);
    }

    if (id) {
      const { data: row, error } = await supabase
        .from("garage_vehicles")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new Error("Vehicle not found or not yours");
      return { id: row.id };
    }

    const { data: row, error } = await supabase
      .from("garage_vehicles")
      .insert({ ...values, user_id: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteGarageVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: photos } = await supabase
      .from("garage_vehicle_photos")
      .select("storage_path")
      .eq("vehicle_id", data.id);
    const paths = (photos ?? []).map((p: { storage_path: string }) => p.storage_path);
    if (paths.length) {
      await supabase.storage.from("garage").remove(paths);
    }
    const { error } = await supabase
      .from("garage_vehicles")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

const addPhotoSchema = z.object({
  vehicleId: z.string().uuid(),
  storage_path: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(200).nullable().optional(),
  sort: z.number().int().min(0).max(999).optional(),
});

export const addGaragePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => addPhotoSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: v } = await supabase
      .from("garage_vehicles")
      .select("id")
      .eq("id", data.vehicleId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!v) throw new Error("Vehicle not found or not yours");

    const { data: row, error } = await supabase
      .from("garage_vehicle_photos")
      .insert({
        vehicle_id: data.vehicleId,
        storage_path: data.storage_path,
        caption: data.caption ?? null,
        sort: data.sort ?? 0,
      })
      .select("id, storage_path")
      .single();
    if (error) throw error;

    const urls = await resolveUrls(supabase, [row.storage_path]);
    return { id: row.id as string, url: urls.get(row.storage_path) ?? "" };
  });

export const deleteGaragePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: photo } = await supabase
      .from("garage_vehicle_photos")
      .select("id, storage_path, vehicle_id, garage_vehicles!inner(user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!photo) throw new Error("Photo not found");
    const owner = (photo as { garage_vehicles?: { user_id: string } }).garage_vehicles?.user_id;
    if (owner !== userId) throw new Error("Not your photo");
    await supabase.storage.from("garage").remove([photo.storage_path]);
    const { error } = await supabase.from("garage_vehicle_photos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const updateMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ avatar_url: z.string().trim().max(2000).nullable() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.avatar_url })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });
