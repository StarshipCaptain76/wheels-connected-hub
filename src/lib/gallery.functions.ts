import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type GalleryItem = {
  id: string;
  title: string | null;
  caption: string | null;
  image_url: string;
  event_id: string | null;
  taken_at: string | null;
  created_at: string;
  is_published?: boolean;
};

export const listGalleryItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryItem[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, title, caption, image_url, event_id, taken_at, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as GalleryItem[];
  },
);

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listAllGalleryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GalleryItem[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, title, caption, image_url, event_id, taken_at, created_at, is_published")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as GalleryItem[];
  });

const createSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  caption: z.string().trim().max(500).nullable().optional(),
  image_url: z.string().trim().min(1).max(1000),
  is_published: z.boolean().default(true),
});

export const createGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("gallery_items")
      .insert(data)
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
    await assertAdmin(supabase, userId);
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
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("gallery_items").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
