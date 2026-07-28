import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EventPhoto = {
  id: string;
  event_id: string;
  user_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  created_at: string;
  display_name: string | null;
  member_number: number | null;
};

async function resolveUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  for (const path of unique) {
    try {
      const { data: pub } = supabase.storage.from("events").getPublicUrl(path);
      if (pub?.publicUrl) {
        map.set(path, pub.publicUrl);
        continue;
      }
    } catch {
      /* fall through */
    }
  }
  const missing = unique.filter((p) => !map.get(p));
  if (missing.length) {
    try {
      const { data } = await supabase.storage
        .from("events")
        .createSignedUrls(missing, 60 * 60 * 24 * 30);
      for (const row of data ?? []) {
        if (row?.path && row?.signedUrl) map.set(row.path, row.signedUrl);
      }
    } catch (e) {
      console.error("event photo sign failed", e);
    }
  }
  return map;
}

export const listEventPhotos = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<EventPhoto[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data: rows, error } = await supabase
      .from("event_photos")
      .select("id, event_id, user_id, storage_path, caption, created_at")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("listEventPhotos", error);
      return [];
    }
    if (!rows?.length) return [];

    const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, member_number")
      .in("id", userIds);
    const byUser = new Map(
      (profiles ?? []).map((p: { id: string; display_name: string | null; member_number: number }) => [
        p.id,
        p,
      ]),
    );

    const urls = await resolveUrls(
      supabase,
      rows.map((r: { storage_path: string }) => r.storage_path),
    );

    return rows.map((r: {
      id: string;
      event_id: string;
      user_id: string;
      storage_path: string;
      caption: string | null;
      created_at: string;
    }) => {
      const p = byUser.get(r.user_id);
      return {
        id: r.id,
        event_id: r.event_id,
        user_id: r.user_id,
        storage_path: r.storage_path,
        url: urls.get(r.storage_path) ?? "",
        caption: r.caption,
        created_at: r.created_at,
        display_name: p?.display_name ?? null,
        member_number: p?.member_number ?? null,
      };
    });
  });

export const addEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        storage_path: z.string().trim().min(1).max(500),
        caption: z.string().trim().max(200).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Event must exist and be published
    const { data: ev } = await supabase
      .from("events")
      .select("id, is_published")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev?.is_published) throw new Error("Event not found");

    const { data: row, error } = await supabase
      .from("event_photos")
      .insert({
        event_id: data.eventId,
        user_id: userId,
        storage_path: data.storage_path,
        caption: data.caption ?? null,
      })
      .select("id, storage_path")
      .single();
    if (error) throw error;

    const urls = await resolveUrls(supabase, [row.storage_path]);
    return { id: row.id as string, url: urls.get(row.storage_path) ?? "" };
  });

export const deleteEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    const { data: photo } = await supabase
      .from("event_photos")
      .select("id, storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!photo) throw new Error("Photo not found");
    if (photo.user_id !== userId && !isAdmin) throw new Error("Not your photo");

    await supabase.storage.from("events").remove([photo.storage_path]);
    const { error } = await supabase.from("event_photos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
