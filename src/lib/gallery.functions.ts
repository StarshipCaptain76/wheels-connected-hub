import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type GalleryItem = {
  id: string;
  title: string | null;
  caption: string | null;
  image_url: string;
  /** Smaller version for the grid. Falls back to image_url when missing. */
  thumb_url: string | null;
  event_id: string | null;
  taken_at: string | null;
  category: string | null;
  created_at: string;
  is_published?: boolean;
};

export const listGalleryItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryItem[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const { signStoredUrls } = await import("./storage-urls.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, title, caption, image_url, thumb_url, event_id, taken_at, category, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as GalleryItem[];
    const toSign = rows.flatMap((r) => [r.image_url, r.thumb_url].filter(Boolean) as string[]);
    const signed = await signStoredUrls(supabase, toSign);
    return rows.map((r) => ({
      ...r,
      image_url: signed.get(r.image_url) ?? r.image_url,
      thumb_url: r.thumb_url ? (signed.get(r.thumb_url) ?? r.thumb_url) : null,
    }));
  },
);

export const listAllGalleryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GalleryItem[]> => {
    const { supabase, userId } = context;
    const { signStoredUrls } = await import("./storage-urls.server");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("gallery_items")
      .select(
        "id, title, caption, image_url, thumb_url, event_id, taken_at, category, created_at, is_published",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as GalleryItem[];
    const toSign = rows.flatMap((r) => [r.image_url, r.thumb_url].filter(Boolean) as string[]);
    const signed = await signStoredUrls(supabase, toSign);
    return rows.map((r) => ({
      ...r,
      image_url: signed.get(r.image_url) ?? r.image_url,
      thumb_url: r.thumb_url ? (signed.get(r.thumb_url) ?? r.thumb_url) : null,
    }));
  });

const createSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  caption: z.string().trim().max(500).nullable().optional(),
  image_url: z.string().trim().min(1).max(1000),
  thumb_url: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  is_published: z.boolean().default(true),
});

export const createGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: row, error } = await supabase
      .from("gallery_items")
      .insert({
        title: data.title ?? null,
        caption: data.caption ?? null,
        image_url: data.image_url,
        thumb_url: data.thumb_url ?? null,
        category: data.category ?? null,
        is_published: data.is_published ?? true,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const togglePublishGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), is_published: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("gallery_items")
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.from("gallery_items").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setGalleryCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        category: z.string().trim().max(120).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("gallery_items")
      .update({ category: data.category || null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
