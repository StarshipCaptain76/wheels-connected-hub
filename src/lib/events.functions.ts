import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  is_published?: boolean;
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

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listAllEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicEvent[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, title_af, description, description_af, location, starts_at, ends_at, cover_url, is_published",
      )
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PublicEvent[];
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
  cover_url: z.string().trim().max(1000).nullable().optional(),
  is_published: z.boolean().default(true),
});

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, ...values } = data;
    if (id) {
      const { error } = await supabase.from("events").update(values).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await supabase
      .from("events")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("events").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
