import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "member" }) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export type AdminMember = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  town: string | null;
  favourite_ride: string | null;
  member_number: number;
  membership_status: string;
  joined_at: string;
  is_admin: boolean;
  is_featured: boolean;
};

export const listAllMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMember[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, phone, town, favourite_ride, member_number, membership_status, joined_at, is_featured",
      )
      .order("member_number", { ascending: true });
    if (error) throw error;

    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminSet = new Set((adminRows ?? []).map((r) => r.user_id));

    // Fetch emails via admin API (server-only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailById = new Map<string, string | null>();
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of usersPage?.users ?? []) emailById.set(u.id, u.email ?? null);

    return (profiles ?? []).map((p) => ({
      user_id: p.id,
      display_name: p.display_name,
      email: emailById.get(p.id) ?? null,
      phone: p.phone,
      town: p.town,
      favourite_ride: p.favourite_ride,
      member_number: p.member_number,
      membership_status: p.membership_status,
      joined_at: p.joined_at,
      is_admin: adminSet.has(p.id),
      is_featured: Boolean(p.is_featured),
    }));
  });

export const updateMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["pending", "active", "suspended"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ membership_status: data.status })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    if (data.userId === context.userId && !data.isAdmin) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabase } = context;
    if (data.isAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true };
  });

export const setFeaturedMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        bio: z.string().trim().max(600).nullable().optional(),
        photoUrl: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabase } = context;
    // Clear existing featured first (unique partial index enforces one).
    const { error: clearErr } = await supabase
      .from("profiles")
      .update({ is_featured: false })
      .eq("is_featured", true);
    if (clearErr) throw clearErr;

    if (data.userId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_featured: true,
          featured_bio: data.bio ?? null,
          featured_photo_url: data.photoUrl ?? null,
          featured_since: new Date().toISOString(),
        })
        .eq("id", data.userId);
      if (error) throw error;
    }
    return { ok: true };
  });
