import { createServerFn } from "@tanstack/react-start";

export type GalleryItem = {
  id: string;
  title: string | null;
  caption: string | null;
  image_url: string;
  event_id: string | null;
  taken_at: string | null;
  created_at: string;
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
