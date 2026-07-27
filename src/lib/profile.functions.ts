import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MemberProfile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  town: string | null;
  favourite_ride: string | null;
  avatar_url: string | null;
  member_number: number;
  membership_status: string;
  joined_at: string;
  email: string | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberProfile> => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, phone, town, favourite_ride, avatar_url, member_number, membership_status, joined_at",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Profile not found");
    return { ...data, email: (claims as { email?: string })?.email ?? null };
  });

const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(80).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  town: z.string().trim().max(80).nullable().optional(),
  favourite_ride: z.string().trim().max(120).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ context, data }): Promise<MemberProfile> => {
    const { supabase, userId, claims } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select(
        "id, display_name, phone, town, favourite_ride, avatar_url, member_number, membership_status, joined_at",
      )
      .single();
    if (error) throw error;
    return { ...row, email: (claims as { email?: string })?.email ?? null };
  });
