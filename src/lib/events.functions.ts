import { createServerFn } from "@tanstack/react-start";

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
};

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
    return (data ?? []) as PublicEvent[];
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
    return (data as PublicEvent | null) ?? null;
  },
);
