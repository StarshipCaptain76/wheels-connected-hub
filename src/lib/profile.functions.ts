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
  preferred_lang: "en" | "af" | null;
  member_number: number;
  membership_status: string;
  joined_at: string;
  email: string | null;
  directory_visible: boolean;
  featured_bio: string | null;
};

const PROFILE_COLS =
  "id, display_name, phone, town, favourite_ride, avatar_url, preferred_lang, member_number, membership_status, joined_at, directory_visible, featured_bio";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberProfile> => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Profile not found");
    return {
      ...data,
      preferred_lang: (data.preferred_lang as "en" | "af" | null) ?? null,
      directory_visible: data.directory_visible !== false,
      email: (claims as { email?: string })?.email ?? null,
    };
  });

const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(80).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  town: z.string().trim().max(80).nullable().optional(),
  favourite_ride: z.string().trim().max(120).nullable().optional(),
  preferred_lang: z.enum(["en", "af"]).nullable().optional(),
  directory_visible: z.boolean().optional(),
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
      .select(PROFILE_COLS)
      .single();
    if (error) throw error;
    return {
      ...row,
      preferred_lang: (row.preferred_lang as "en" | "af" | null) ?? null,
      directory_visible: row.directory_visible !== false,
      email: (claims as { email?: string })?.email ?? null,
    };
  });
